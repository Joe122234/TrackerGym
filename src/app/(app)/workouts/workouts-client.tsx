"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Dumbbell,
  HeartPulse,
  History,
  Layers,
  Moon,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Trash2,
  Trophy,
  Weight,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ExerciseDefinition,
  ScheduleEntry,
  WorkoutSession,
  WorkoutTemplate,
} from "@/domain/types";
import { WEEKDAYS, WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/domain/types";
import {
  formatDateKey,
  formatDurationLong,
  todayKey,
  weekdayForDateKey,
} from "@/domain/dates";
import {
  getSessionSetCounts,
  getTotalVolumeKg,
  summarizeSession,
} from "@/domain/workout";
import { formatVolume } from "@/domain/units";
import {
  deleteWorkoutTemplate,
  duplicateWorkoutTemplate,
  setScheduleDay,
} from "@/lib/firebase/profile";
import { useAuth } from "@/hooks/use-auth";
import { useSessions } from "@/hooks/use-sessions";
import { useStartWorkout } from "@/hooks/use-start-workout";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type TabValue = "schedule" | "templates" | "history";

const TABS: TabValue[] = ["schedule", "templates", "history"];

function readTab(value: string | null): TabValue {
  return TABS.includes(value as TabValue) ? (value as TabValue) : "schedule";
}

function templateStats(template: WorkoutTemplate) {
  const enabled = template.exercises.filter((exercise) => exercise.enabled);
  return {
    exercises: enabled.length,
    sets: enabled.reduce((total, exercise) => total + exercise.targetSets, 0),
  };
}

function sessionSummary(session: WorkoutSession) {
  return session.summary ?? summarizeSession(session);
}

function sessionDuration(session: WorkoutSession): number {
  if (session.summary) return session.summary.durationSeconds;
  return session.completedAt
    ? Math.floor((session.completedAt - session.startedAt) / 1000)
    : 0;
}

function TodayPlanCard({
  schedule,
  templates,
  sessions,
  today,
}: {
  schedule: ScheduleEntry[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  today: string;
}) {
  const weekday = weekdayForDateKey(today);
  const entry = schedule.find((candidate) => candidate.day === weekday);
  const template = templates.find(
    (candidate) => candidate.id === entry?.templateId,
  );
  const completed = sessions.find(
    (session) =>
      session.scheduledDate === today && session.source === "scheduled",
  );
  const { startWorkout, startingId, activeSession, activeLoading } =
    useStartWorkout();

  return (
    <div className="relative overflow-hidden rounded-panel border border-line bg-surface p-5 sm:p-6">
      <div className="surface-grid absolute inset-0 opacity-20" aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl border",
              entry?.kind === "training"
                ? "border-lime/20 bg-lime/10 text-lime"
                : "border-line bg-elevated text-muted",
            )}
          >
            {entry?.kind === "training" ? (
              template?.type === "cardio" ? (
                <HeartPulse className="size-5" />
              ) : (
                <Dumbbell className="size-5" />
              )
            ) : (
              <Moon className="size-5" />
            )}
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
              {formatDateKey(today, "EEEE, MMMM d")}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.025em] text-ink">
              {completed
                ? `${completed.templateName} complete`
                : entry?.kind === "training" && template
                  ? template.name
                  : "Rest day"}
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              {completed
                ? `${getSessionSetCounts(completed).completed} sets · ${formatDurationLong(
                    sessionDuration(completed),
                  )}`
                : entry?.kind === "training" && template
                  ? `${templateStats(template).exercises} exercises · ${templateStats(template).sets} target sets`
                  : "Recovery is already built into the split."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {activeSession ? (
            <Button asChild>
              <Link href="/workout/">
                Resume {activeSession.templateName} <ArrowRight />
              </Link>
            </Button>
          ) : completed ? (
            <Button asChild variant="secondary">
              <Link
                href={`/workouts/session/?id=${encodeURIComponent(completed.id)}`}
              >
                View session <ArrowRight />
              </Link>
            </Button>
          ) : entry?.kind === "training" && template ? (
            <Button
              onClick={() => void startWorkout(template)}
              loading={startingId === template.id || activeLoading}
            >
              {template.type === "cardio" ? "Log cardio" : "Start today"} <Play />
            </Button>
          ) : (
            <span className="text-[11px] text-muted-2">
              Next training day is in your split.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleTab({
  schedule,
  templates,
  sessions,
  today,
  hasActive,
}: {
  schedule: ScheduleEntry[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  today: string;
  hasActive: boolean;
}) {
  const { user } = useAuth();
  const [busyDay, setBusyDay] = React.useState<string | null>(null);
  const todayWeekday = weekdayForDateKey(today);

  const handleChange = async (day: (typeof WEEKDAYS)[number], value: string) => {
    if (!user) return;
    const template =
      value === "__rest"
        ? null
        : templates.find((candidate) => candidate.id === value) ?? null;
    if (value !== "__rest" && !template) return;
    setBusyDay(day);
    try {
      await setScheduleDay(user.uid, day, template, schedule);
      toast.success(
        `${WEEKDAY_LABELS[day]} set to ${template?.name ?? "rest"}.`,
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not update the schedule.",
      );
    } finally {
      setBusyDay(null);
    }
  };

  return (
    <div className="space-y-5">
      <TodayPlanCard
        schedule={schedule}
        templates={templates}
        sessions={sessions}
        today={today}
      />

      {hasActive ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-lime/15 bg-lime/[0.045] p-3.5 text-[11px] leading-relaxed text-muted">
          <RefreshCcw className="mt-0.5 size-3.5 shrink-0 text-lime" />
          You have an active workout. Schedule edits only affect future
          sessions; the workout already in progress keeps its snapshot.
        </div>
      ) : null}

      <div>
        <SectionHeading
          title="Weekly split"
          description="Swap a day or assign a different template. Edits never rewrite past sessions."
        />
        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          {WEEKDAYS.map((day) => {
            const entry = schedule.find((candidate) => candidate.day === day);
            const template = templates.find(
              (candidate) => candidate.id === entry?.templateId,
            );
            const isToday = day === todayWeekday;
            const stats = template ? templateStats(template) : null;
            return (
              <div
                key={day}
                className={cn(
                  "flex flex-col gap-3 border-b border-line/60 p-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4",
                  isToday && "bg-lime/[0.03]",
                )}
              >
                <div className="flex min-w-0 items-center gap-3 sm:w-[160px] sm:shrink-0">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 flex-col items-center justify-center rounded-xl border text-[9px] font-semibold uppercase leading-none tracking-[0.06em]",
                      isToday
                        ? "border-lime/30 bg-lime/10 text-lime"
                        : "border-line bg-elevated text-muted",
                    )}
                  >
                    <span>{WEEKDAY_SHORT[day]}</span>
                    <span
                      className={cn(
                        "mt-1 size-1 rounded-full",
                        isToday ? "bg-lime" : "bg-muted-2/50",
                      )}
                    />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">
                      {WEEKDAY_LABELS[day]}
                      {isToday ? (
                        <span className="ml-2 text-[9px] font-medium uppercase tracking-[0.1em] text-lime">
                          today
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-2">
                      {entry?.kind === "rest" || !template
                        ? "Rest & recover"
                        : template.type === "cardio"
                          ? "Cardio"
                          : `${stats?.exercises ?? 0} exercises · ${stats?.sets ?? 0} sets`}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <Select
                    value={template?.id ?? "__rest"}
                    onValueChange={(value) => void handleChange(day, value)}
                    disabled={busyDay === day}
                  >
                    <SelectTrigger
                      aria-label={`Template for ${WEEKDAY_LABELS[day]}`}
                      className="h-10 bg-canvas-soft text-[13px]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__rest">
                        <span className="flex items-center gap-2 text-muted">
                          <Moon className="size-3.5" /> Rest day
                        </span>
                      </SelectItem>
                      {templates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          <span className="flex items-center gap-2">
                            {candidate.type === "cardio" ? (
                              <HeartPulse className="size-3.5 text-blue" />
                            ) : (
                              <Dumbbell className="size-3.5 text-muted-2" />
                            )}
                            {candidate.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {template ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/workouts/template/?id=${encodeURIComponent(template.id)}`}>
                        <Pencil /> Edit
                      </Link>
                    </Button>
                  ) : null}
                  <Badge variant={template ? "lime" : "default"}>
                    {template ? "Training" : "Rest"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  schedule,
  sessions,
  exerciseDefinitions,
  activeTemplateId,
}: {
  template: WorkoutTemplate;
  schedule: ScheduleEntry[];
  sessions: WorkoutSession[];
  exerciseDefinitions: ExerciseDefinition[];
  activeTemplateId: string | null;
}) {
  const { user } = useAuth();
  const { startWorkout, startingId, activeLoading } = useStartWorkout();
  const [duplicating, setDuplicating] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const stats = templateStats(template);
  const days = schedule.filter((entry) => entry.templateId === template.id);
  const lastSession = sessions.find(
    (session) => session.templateId === template.id,
  );
  const isActive = activeTemplateId === template.id;
  const blockedByOther = Boolean(activeTemplateId && !isActive);

  const handleDuplicate = async () => {
    if (!user) return;
    setDuplicating(true);
    try {
      const copy = await duplicateWorkoutTemplate(user.uid, template);
      toast.success(`${copy.name} created.`);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not duplicate template.",
      );
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteWorkoutTemplate(user.uid, template.id, schedule);
      toast.success(`${template.name} deleted.`);
      setDeleteOpen(false);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not delete template.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className={cn("flex flex-col p-5", isActive && "border-lime/25 bg-lime/[0.035]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={template.type === "cardio" ? "blue" : "lime"}>
              {template.type === "cardio" ? "Cardio" : "Strength"}
            </Badge>
            {isActive ? <Badge variant="success" dot>Active</Badge> : null}
          </div>
          <h3 className="mt-2.5 truncate text-base font-semibold tracking-[-0.02em] text-ink">
            {template.name}
          </h3>
          <p className="mt-1 text-[11px] text-muted">
            {template.type === "cardio"
              ? "Duration-led session"
              : `${stats.exercises} exercises · ${stats.sets} target sets`}
          </p>
        </div>
        <Button
          asChild
          variant="ghost"
          size="iconSm"
          aria-label={`Edit ${template.name}`}
        >
          <Link href={`/workouts/template/?id=${encodeURIComponent(template.id)}`}>
            <Pencil />
          </Link>
        </Button>
      </div>

      {template.type === "strength" ? (
        <div className="mt-4 min-h-[62px] space-y-1 border-y border-line/60 py-3">
          {template.exercises
            .filter((exercise) => exercise.enabled)
            .slice(0, 3)
            .map((exercise) => (
              <p
                key={exercise.id}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <span className="truncate text-muted">
                  {exerciseDefinitions.find(
                    (definition) => definition.id === exercise.exerciseId,
                  )?.name || "Exercise"}
                </span>
                <span className="shrink-0 text-muted-2">
                  {exercise.targetSets} × {exercise.targetReps}
                </span>
              </p>
            ))}
          {stats.exercises > 3 ? (
            <p className="text-[10px] text-muted-2">
              +{stats.exercises - 3} more
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex min-h-[62px] items-center border-y border-line/60 py-3">
          <p className="text-[11px] leading-relaxed text-muted">
            Duration, distance, incline, and effort are logged independently.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {days.length > 0 ? (
          days.map((entry) => (
            <Badge key={entry.day} variant="outline">
              {WEEKDAY_SHORT[entry.day]}
            </Badge>
          ))
        ) : (
          <span className="text-[10px] text-muted-2">Not scheduled</span>
        )}
        {lastSession ? (
          <span className="ml-auto text-[10px] text-muted-2">
            Last: {formatDateKey(lastSession.scheduledDate, "MMM d")}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <Button
          className="flex-1"
          size="sm"
          onClick={() => void startWorkout(template)}
          disabled={blockedByOther}
          loading={startingId === template.id || activeLoading}
        >
          {isActive ? "Resume" : template.type === "cardio" ? "Log cardio" : "Start"}
          <ArrowRight />
        </Button>
        <Button
          variant="secondary"
          size="iconSm"
          onClick={() => void handleDuplicate()}
          loading={duplicating}
          aria-label={`Duplicate ${template.name}`}
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setDeleteOpen(true)}
          aria-label={`Delete ${template.name}`}
          className="text-muted-2 hover:text-danger"
        >
          <Trash2 />
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {template.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The template will be removed and any scheduled days will become
              rest days. Completed workout history keeps its original snapshot.
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
              {deleting ? "Deleting…" : "Delete template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function TemplatesTab({
  templates,
  schedule,
  sessions,
  exerciseDefinitions,
  activeTemplateId,
}: {
  templates: WorkoutTemplate[];
  schedule: ScheduleEntry[];
  sessions: WorkoutSession[];
  exerciseDefinitions: ExerciseDefinition[];
  activeTemplateId: string | null;
}) {
  return (
    <div>
      <SectionHeading
        title="Your templates"
        description="The plan you train. History is a snapshot and stays intact when templates change."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/workouts/template/">
              <Plus /> New template
            </Link>
          </Button>
        }
      />
      {templates.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-5" />}
          title="No templates yet"
          description="Create your first strength or cardio workout to get moving."
          action={
            <Button asChild>
              <Link href="/workouts/template/">
                <Plus /> Create template
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              schedule={schedule}
              sessions={sessions}
              exerciseDefinitions={exerciseDefinitions}
              activeTemplateId={activeTemplateId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTab({
  sessions,
  weightUnit,
  timezone,
}: {
  sessions: WorkoutSession[];
  weightUnit: "kg" | "lb";
  timezone: string;
}) {
  const totals = React.useMemo(() => {
    return sessions.reduce(
      (result, session) => {
        const counts = getSessionSetCounts(session);
        result.sets += counts.completed;
        result.volume += getTotalVolumeKg(session);
        result.prs += session.summary?.prs.length ?? 0;
        return result;
      },
      { sets: 0, volume: 0, prs: 0 },
    );
  }, [sessions]);

  const groups = React.useMemo(() => {
    const byMonth = new Map<string, WorkoutSession[]>();
    for (const session of sessions) {
      const key = formatDateKey(session.scheduledDate, "MMMM yyyy");
      const list = byMonth.get(key) ?? [];
      list.push(session);
      byMonth.set(key, list);
    }
    return [...byMonth.entries()].map(([month, items]) => ({
      month,
      items: items.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    }));
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-5" />}
        title="No completed sessions yet"
        description="Your history begins with the first workout you finish. Nothing is pre-filled."
        action={
          <Button asChild>
            <Link href="/workouts/?tab=schedule">
              Go to the split <ArrowRight />
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Workouts"
          value={sessions.length}
          hint="All time"
          icon={<Dumbbell className="size-4" />}
          accent="lime"
        />
        <StatTile
          label="Sets"
          value={totals.sets}
          hint="Completed"
          icon={<Check className="size-4" />}
        />
        <StatTile
          label="Volume"
          value={formatVolume(totals.volume, weightUnit)}
          hint="Numeric sets only"
          icon={<Weight className="size-4" />}
          accent="violet"
        />
        <StatTile
          label="PR marks"
          value={totals.prs}
          hint="Across sessions"
          icon={<Trophy className="size-4" />}
          accent="blue"
        />
      </div>

      <div className="mt-7">
        <SectionHeading
          title="Session history"
          description={`All dates in ${timezone.replace(/_/g, " ")}.`}
        />
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.month}>
              <div className="mb-2.5 flex items-center gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-2">
                  {group.month}
                </h3>
                <span className="h-px flex-1 bg-line/60" />
                <span className="text-[10px] text-muted-2">
                  {group.items.length} session{group.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-hidden rounded-panel border border-line bg-surface">
                {group.items.map((session) => {
                  const summary = sessionSummary(session);
                  return (
                    <Link
                      key={session.id}
                      href={`/workouts/session/?id=${encodeURIComponent(session.id)}`}
                      className="flex items-center gap-3 border-b border-line/60 p-4 transition-colors last:border-b-0 hover:bg-elevated/45 sm:gap-4"
                    >
                      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-canvas-soft">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-2">
                          {formatDateKey(session.scheduledDate, "MMM")}
                        </span>
                        <span className="tabular text-sm font-semibold text-ink">
                          {Number(session.scheduledDate.slice(8))}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {session.templateName}
                          </p>
                          {session.source === "extra" ? (
                            <Badge variant="violet">Extra</Badge>
                          ) : null}
                          {(summary.prs?.length ?? 0) > 0 ? (
                            <Badge variant="lime">
                              <Trophy className="size-3" /> {summary.prs.length} PR
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-2">
                          <span className="flex items-center gap-1">
                            <Clock3 className="size-3" />
                            {formatDurationLong(sessionDuration(session))}
                          </span>
                          <span>{getSessionSetCounts(session).completed} sets</span>
                          {summary.totalVolumeKg > 0 ? (
                            <span>
                              {formatVolume(summary.totalVolumeKg, weightUnit)}
                            </span>
                          ) : null}
                          {session.workoutType === "cardio" && session.cardio?.durationSeconds ? (
                            <span>
                              {formatDurationLong(session.cardio.durationSeconds)}{" "}
                              cardio
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-2" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkoutsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile } = useUserData();
  const { sessions, loading } = useSessions();
  const { schedule, templates, exerciseDefinitions } = useUserData();
  const { startWorkout, startingId, activeSession, activeLoading } =
    useStartWorkout();
  const [tab, setTab] = React.useState<TabValue>(() =>
    readTab(searchParams.get("tab")),
  );
  const timezone = profile?.timezone ?? "Asia/Bangkok";
  const today = todayKey(timezone);

  React.useEffect(() => {
    setTab(readTab(searchParams.get("tab")));
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    const next = readTab(value);
    setTab(next);
    router.replace(`/workouts/?tab=${next}`, { scroll: false });
  };

  const todayEntry = schedule.find(
    (entry) => entry.day === weekdayForDateKey(today),
  );
  const todayTemplate = templates.find(
    (template) => template.id === todayEntry?.templateId,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="Workouts"
        description="Your split, your templates, and every honest session you have finished."
        actions={
          <>
            {todayTemplate && todayEntry?.kind === "training" && !activeSession ? (
              <Button
                onClick={() => void startWorkout(todayTemplate)}
                loading={startingId === todayTemplate.id || activeLoading}
              >
                {todayTemplate.type === "cardio" ? "Log cardio" : "Start today"}
                <Play />
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href="/workouts/template/">
                <Plus /> New template
              </Link>
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={handleTabChange} className="mt-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="schedule">
            <CalendarDays className="size-3.5" /> Schedule
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Layers className="size-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-3.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <ScheduleTab
            schedule={schedule}
            templates={templates}
            sessions={sessions}
            today={today}
            hasActive={Boolean(activeSession)}
          />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab
            templates={templates}
            schedule={schedule}
            sessions={sessions}
            exerciseDefinitions={exerciseDefinitions}
            activeTemplateId={activeSession?.templateId ?? null}
          />
        </TabsContent>
        <TabsContent value="history">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="skeleton h-20 rounded-2xl" />
              ))}
            </div>
          ) : (
            <HistoryTab
              sessions={sessions}
              weightUnit={profile?.weightUnit ?? "kg"}
              timezone={timezone}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
