"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Circle,
  Clock3,
  Dumbbell,
  FileDown,
  Flame,
  HeartPulse,
  History,
  Minus,
  Mountain,
  NotebookPen,
  RefreshCcw,
  Timer,
  Trash2,
  Trophy,
  Weight,
} from "lucide-react";
import { toast } from "sonner";
import type {
  SessionExercise,
  SessionSet,
  WorkoutSession,
  WorkoutSummary,
} from "@/domain/types";
import {
  formatDateKey,
  formatDurationLong,
  formatTimestamp,
} from "@/domain/dates";
import {
  getSessionSetCounts,
  getTotalVolumeKg,
  summarizeSession,
} from "@/domain/workout";
import {
  formatLoad,
  formatVolume,
  formatWeight,
  secondsToPace,
} from "@/domain/units";
import { deleteCompletedSession } from "@/lib/firebase/sessions";
import { useAuth } from "@/hooks/use-auth";
import { useSessions } from "@/hooks/use-sessions";
import { useUserData } from "@/hooks/use-user-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  PageHeader,
  SectionHeading,
  StatTile,
} from "@/components/ui/layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function summaryFor(session: WorkoutSession): WorkoutSummary {
  return session.summary ?? summarizeSession(session, []);
}

function setStatusLabel(set: SessionSet): string {
  if (set.status === "completed") return "Complete";
  if (set.status === "skipped") return "Skipped";
  return "Incomplete";
}

function SetResult({
  set,
  unit,
}: {
  set: SessionSet;
  unit: "kg" | "lb";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2",
        set.status === "completed"
          ? "border-lime/15 bg-lime/[0.035]"
          : set.status === "skipped"
            ? "border-line/60 bg-canvas-soft/30"
            : "border-line/60 bg-canvas-soft/20",
      )}
    >
      <span className="w-4 shrink-0 text-center text-[9px] font-semibold text-muted-2">
        {set.order + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="tabular text-[12px] font-medium text-ink">
          {set.loadDescription
            ? set.loadDescription
            : set.weightKg === null
              ? "No weight"
              : formatWeight(set.weightKg, unit)}
          <span className="text-muted-2"> × </span>
          {set.reps === null ? "—" : set.reps}
        </p>
        {set.note ? (
          <p className="mt-0.5 truncate text-[10px] text-muted-2">{set.note}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-[0.08em]",
          set.status === "completed"
            ? "text-lime"
            : set.status === "skipped"
              ? "text-warning"
              : "text-muted-2",
        )}
      >
        {set.status === "completed" ? (
          <Check className="size-2.5" />
        ) : set.status === "skipped" ? (
          <Minus className="size-2.5" />
        ) : (
          <Circle className="size-2.5" />
        )}
        {setStatusLabel(set)}
      </span>
    </div>
  );
}

function ExerciseResult({
  exercise,
  unit,
  prs,
}: {
  exercise: SessionExercise;
  unit: "kg" | "lb";
  prs: WorkoutSummary["prs"];
}) {
  const completed = exercise.sets.filter(
    (set) => set.status === "completed",
  ).length;
  const exercisePrs = prs.filter(
    (pr) => pr.exerciseId === exercise.exerciseId,
  );
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated text-muted-2">
          <Dumbbell className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[13px] font-semibold text-ink">
              {exercise.name}
            </h3>
            {exercisePrs.map((pr) => (
              <Badge key={`${pr.scopeKey}-${pr.metric}`} variant="lime">
                <Trophy className="size-3" /> {pr.label}
              </Badge>
            ))}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-2">
            {completed}/{exercise.sets.length} sets ·{" "}
            {formatLoad(exercise.load, unit)} · target {exercise.targetSets} ×{" "}
            {exercise.targetReps}
          </p>
          {exercise.note ? (
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              {exercise.note}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5 border-t border-line/60 bg-canvas-soft/25 p-3">
        {exercise.sets.map((set) => (
          <SetResult key={set.id} set={set} unit={unit} />
        ))}
      </div>
    </Card>
  );
}

export function SessionDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const finished = searchParams.get("finished") === "1";
  const { user } = useAuth();
  const { sessions, loading, error, retry } = useSessions();
  const { profile } = useUserData();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [waitExpired, setWaitExpired] = React.useState(false);
  const unit = profile?.weightUnit ?? "kg";
  const session = id
    ? sessions.find((candidate) => candidate.id === id) ?? null
    : null;

  React.useEffect(() => {
    setWaitExpired(false);
    const timer = window.setTimeout(() => setWaitExpired(true), 2500);
    return () => window.clearTimeout(timer);
  }, [id, finished]);

  const handleDelete = async () => {
    if (!user || !session) return;
    setDeleting(true);
    try {
      await deleteCompletedSession(user.uid, session.id);
      toast.success("Session deleted. PRs and records were rebuilt.");
      router.replace("/workouts/?tab=history");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not delete the session.",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!id) {
    return (
      <EmptyState
        icon={<History className="size-5" />}
        title="No session selected"
        description="Open a workout from your history to see its full record."
        action={
          <Button asChild>
            <Link href="/workouts/?tab=history">
              <ArrowLeft /> Back to history
            </Link>
          </Button>
        }
      />
    );
  }

  if (loading || (!session && !waitExpired)) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-56 rounded-panel" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<RefreshCcw className="size-5" />}
        title="History unavailable"
        description={error}
        action={<Button onClick={retry}>Retry</Button>}
      />
    );
  }

  if (!session) {
    return (
      <EmptyState
        icon={<History className="size-5" />}
        title="Session not found"
        description="This workout may have been deleted, or it belongs to a different account."
        action={
          <Button asChild>
            <Link href="/workouts/?tab=history">
              <ArrowLeft /> Back to history
            </Link>
          </Button>
        }
      />
    );
  }

  const summary = summaryFor(session);
  const counts = getSessionSetCounts(session);
  const volume = summary.totalVolumeKg || getTotalVolumeKg(session);
  const finishedDate = formatTimestamp(
    session.completedAt ?? session.startedAt,
    session.timezone,
    "EEEE, MMMM d, yyyy · h:mm a",
  );
  const cardio = session.cardio;

  return (
    <div>
      <PageHeader
        eyebrow="Session"
        title={session.templateName}
        description={`${finishedDate} · ${session.source === "scheduled" ? "Scheduled session" : "Extra session"}`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/workouts/?tab=history">
                <ArrowLeft /> History
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(true)}
              className="text-muted-2 hover:text-danger"
            >
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      {finished ? (
        <div className="mt-5 flex items-start gap-3 rounded-panel border border-lime/20 bg-lime/[0.045] p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-lime/25 bg-lime/10 text-lime">
            <Check className="size-4" />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-ink">
              Workout saved to your record.
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              PRs and records were calculated from completed sets only.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Duration"
          value={formatDurationLong(summary.durationSeconds)}
          hint={formatDateKey(session.scheduledDate, "EEE, MMM d")}
          icon={<Clock3 className="size-4" />}
          accent="lime"
        />
        <StatTile
          label="Sets"
          value={`${counts.completed}/${counts.total}`}
          hint={
            counts.skipped > 0
              ? `${counts.skipped} skipped · ${counts.pending} incomplete`
              : `${counts.pending} left incomplete`
          }
          icon={<Check className="size-4" />}
        />
        <StatTile
          label="Volume"
          value={session.workoutType === "cardio" ? "—" : formatVolume(volume, unit)}
          hint={`${summary.volumeIncludedSets} numeric sets`}
          icon={<Weight className="size-4" />}
          accent="violet"
        />
        <StatTile
          label="PR marks"
          value={summary.prs.length}
          hint={
            summary.prs.length > 0
              ? summary.prs.map((pr) => pr.label).join(", ")
              : "No records this session"
          }
          icon={<Trophy className="size-4" />}
          accent="blue"
        />
      </div>

      {summary.prs.length > 0 ? (
        <div className="mt-4 rounded-panel border border-lime/20 bg-lime/[0.04] p-4">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-lime" />
            <p className="text-[12px] font-semibold text-ink">
              New personal records
            </p>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {summary.prs.map((pr) => (
              <Badge key={`${pr.scopeKey}-${pr.metric}`} variant="lime">
                {pr.label} · {pr.value}
                {pr.unit}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-7">
        <SectionHeading
          title="Session detail"
          description="The exact snapshot saved when this workout was completed."
        />

        {session.workoutType === "cardio" && cardio ? (
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <HeartPulse className="size-4 text-blue" />
              <h2 className="text-[14px] font-semibold text-ink">
                {cardio.activityType || "Cardio session"}
              </h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Duration",
                  value: cardio.durationSeconds
                    ? formatDurationLong(cardio.durationSeconds)
                    : "—",
                  icon: Clock3,
                },
                {
                  label: "Distance",
                  value:
                    cardio.distanceKm === null
                      ? "—"
                      : `${cardio.distanceKm} km`,
                  icon: Mountain,
                },
                {
                  label: "Pace",
                  value: secondsToPace(cardio.avgPaceSecondsPerKm),
                  icon: Timer,
                },
                {
                  label: "Intensity",
                  value:
                    cardio.intensity === null
                      ? "—"
                      : `${cardio.intensity}/10`,
                  icon: Flame,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-line bg-canvas-soft/45 p-3"
                >
                  <item.icon className="size-3.5 text-muted-2" />
                  <p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-muted-2">
                    {item.label}
                  </p>
                  <p className="tabular mt-0.5 text-sm font-semibold text-ink">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 border-t border-line/60 pt-4 text-[11px] sm:grid-cols-2">
              <p>
                <span className="text-muted-2">Speed: </span>
                <span className="text-ink">
                  {cardio.speedKph === null ? "—" : `${cardio.speedKph} km/h`}
                </span>
              </p>
              <p>
                <span className="text-muted-2">Incline: </span>
                <span className="text-ink">
                  {cardio.inclinePercent === null
                    ? "—"
                    : `${cardio.inclinePercent}%`}
                </span>
              </p>
              <p className="sm:col-span-2">
                <span className="text-muted-2">Equipment: </span>
                <span className="text-ink">{cardio.equipment || "—"}</span>
              </p>
            </div>
            {cardio.notes ? (
              <div className="mt-4 rounded-xl border border-line/60 bg-canvas-soft/35 p-3">
                <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-muted-2">
                  <NotebookPen className="size-3" /> Cardio notes
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
                  {cardio.notes}
                </p>
              </div>
            ) : null}
          </Card>
        ) : (
          <div className="space-y-3">
            {session.exercises.map((exercise) => (
              <ExerciseResult
                key={exercise.id}
                exercise={exercise}
                unit={unit}
                prs={summary.prs}
              />
            ))}
          </div>
        )}

        {session.notes ? (
          <Card className="mt-4 p-5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-2">
              <NotebookPen className="size-3.5" /> Session notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
              {session.notes}
            </p>
          </Card>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary">
          <Link href="/workouts/?tab=history">
            <History /> All history
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-2">
          <FileDown className="size-3" /> Export available in Settings
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The workout will be removed from history. PRs, records, streaks,
              and every later session summary will be rebuilt from the
              remaining completed sessions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
