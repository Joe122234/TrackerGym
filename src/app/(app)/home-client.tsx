"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  History,
  Moon,
  Plus,
  RotateCcw,
  Scale,
  Sparkles,
  Target,
  Trophy,
  Weight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AttendanceDay,
  ScheduleEntry,
  WorkoutSession,
  WorkoutTemplate,
} from "@/domain/types";
import { WEEKDAY_SHORT } from "@/domain/types";
import type { StreakStats } from "@/domain/dates";
import {
  addDaysToKey,
  buildAttendance,
  calculateStreakStats,
  dateKeyInTimeZone,
  formatDateKey,
  formatDurationLong,
  formatTimestamp,
  startOfWeekKey,
  todayKey,
  weekdayForDateKey,
} from "@/domain/dates";
import {
  getSessionSetCounts,
  getTotalVolumeKg,
} from "@/domain/workout";
import { formatVolume, formatWeight, formatDeltaWeight } from "@/domain/units";
import { recentUniquePrs } from "@/domain/records";
import { startActiveSession } from "@/lib/firebase/sessions";
import { markAchievementSeen } from "@/lib/firebase/derived";
import { saveDraftBackup } from "@/hooks/use-active-workout";
import { useActiveWorkout } from "@/hooks/use-active-workout";
import { useAuth } from "@/hooks/use-auth";
import { useDerived } from "@/hooks/use-derived";
import { useMeasurements } from "@/hooks/use-measurements";
import { useSessions } from "@/hooks/use-sessions";
import { useUserData } from "@/hooks/use-user-data";
import {
  formatRecordSecondary,
  formatRecordValue,
} from "@/lib/format-records";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, MetricRing, SectionHeading, StatTile } from "@/components/ui/layout";
import { Sparkline } from "@/components/ui/sparkline";
import { RecapButton } from "@/components/recap/recap-dialog";

function greetingFor(timezone: string, now: number): string {
  const hour = Number(formatTimestamp(now, timezone, "H"));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function nextTrainingDay(
  schedule: ScheduleEntry[],
  today: string,
): { date: string; entry: ScheduleEntry } | null {
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = addDaysToKey(today, offset);
    const entry = schedule.find(
      (candidate) => candidate.day === weekdayForDateKey(date),
    );
    if (entry?.kind === "training" && entry.templateId) {
      return { date, entry };
    }
  }
  return null;
}

function summaryForSession(session: WorkoutSession) {
  if (session.summary) return session.summary;
  const counts = getSessionSetCounts(session);
  return {
    durationSeconds: session.completedAt
      ? Math.floor((session.completedAt - session.startedAt) / 1000)
      : 0,
    setsCompleted: counts.completed,
    totalVolumeKg: getTotalVolumeKg(session),
    totalReps: 0,
    exercisesPlanned: session.exercises.length,
    exercisesCompleted: 0,
    setsSkipped: counts.skipped,
    volumeIncludedSets: 0,
    volumeExcludedSets: 0,
    prs: [],
    isCardio: session.workoutType === "cardio",
  };
}

function AchievementBanner({
  achievements,
  timezone,
  onDismiss,
}: {
  achievements: ReturnType<typeof useDerived>["achievements"];
  timezone: string;
  onDismiss: (id: string) => void;
}) {
  const achievement = achievements.find(
    (candidate) => candidate.seenAt === null,
  );
  if (!achievement) return null;
  return (
    <div className="mb-5 flex items-start gap-3 overflow-hidden rounded-2xl border border-violet/20 bg-violet/[0.065] p-4 animate-fade-up">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet/20 bg-violet/10 text-violet">
        <Award className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet">
          Milestone · {formatTimestamp(achievement.earnedAt, timezone, "MMM d")}
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">{achievement.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {achievement.description}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(achievement.id)}
        className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-violet/10 hover:text-ink"
        aria-label="Dismiss milestone"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function RecoveryCard({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-warning/20 bg-warning/10 text-warning">
          <RotateCcw className="size-4" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-ink">
            Local workout draft found
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            Saved on this device{" "}
            {formatTimestamp(savedAt, "UTC", "MMM d, h:mm a")} UTC. Restore it
            if Firestore has not caught up.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onDiscard}>
          Discard
        </Button>
        <Button size="sm" onClick={onRestore}>
          Restore draft
        </Button>
      </div>
    </div>
  );
}

export function HomeClient() {
  const { user } = useAuth();
  const {
    profile,
    schedule,
    templates,
    exerciseDefinitions,
    loading: dataLoading,
  } = useUserData();
  const { sessions, loading: sessionsLoading } = useSessions();
  const { activeSession, loading: activeLoading, recoveryDraft, restoreDraft, discardRecoveryDraft } =
    useActiveWorkout();
  const { records, achievements } = useDerived();
  const { measurements } = useMeasurements();
  const router = useRouter();
  const [startingId, setStartingId] = React.useState<string | null>(null);
  const [dismissedAchievement, setDismissedAchievement] = React.useState<
    string | null
  >(null);
  const [recoveryBusy, setRecoveryBusy] = React.useState(false);
  const [now] = React.useState(() => Date.now());

  const timezone = profile?.timezone ?? "Asia/Bangkok";
  const today = todayKey(timezone, now);
  const weekStart = startOfWeekKey(today);
  const todayWeekday = weekdayForDateKey(today);
  const scheduleEntry = schedule.find((entry) => entry.day === todayWeekday);
  const todayTemplate = templates.find(
    (template) => template.id === scheduleEntry?.templateId,
  );
  const todaySessions = sessions.filter(
    (session) => session.scheduledDate === today,
  );
  const scheduledCompleted = todaySessions.find(
    (session) => session.source === "scheduled",
  );
  const extraToday = todaySessions.filter(
    (session) => session.source === "extra",
  );
  const displayedCompleted = scheduledCompleted ?? extraToday[0] ?? null;

  const attendance = React.useMemo(() => {
    if (!profile) return [] as AttendanceDay[];
    const start = dateKeyInTimeZone(profile.createdAt, timezone);
    return buildAttendance(
      start <= today ? start : today,
      today,
      today,
      schedule,
      sessions,
    );
  }, [profile, timezone, today, schedule, sessions]);

  const weekAttendance = attendance.filter(
    (day) => day.date >= weekStart && day.date <= addDaysToKey(weekStart, 6),
  );
  const streakStats: StreakStats = React.useMemo(
    () => calculateStreakStats(attendance, today, weekStart),
    [attendance, today, weekStart],
  );

  const weekSessions = sessions.filter(
    (session) =>
      session.scheduledDate >= weekStart &&
      session.scheduledDate <= addDaysToKey(weekStart, 6),
  );
  const weekSets = weekSessions.reduce(
    (total, session) => total + getSessionSetCounts(session).completed,
    0,
  );
  const weekVolume = weekSessions.reduce(
    (total, session) => total + getTotalVolumeKg(session),
    0,
  );
  const weekReps = weekSessions.reduce(
    (total, session) =>
      total + (summaryForSession(session).totalReps ?? 0),
    0,
  );

  const recentRecords = recentUniquePrs(records, 3);
  const latestWorkout = sessions[0] ?? null;
  const weightMeasurements = measurements
    .filter((measurement) => measurement.metric === "bodyWeight")
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
    );
  const latestWeight = weightMeasurements.at(-1) ?? null;
  const previousWeight = weightMeasurements.at(-2) ?? null;
  const weightChange =
    latestWeight && previousWeight
      ? latestWeight.value - previousWeight.value
      : null;

  const todayEnabledExercises =
    todayTemplate?.exercises
      .filter((exercise) => exercise.enabled)
      .sort((a, b) => a.order - b.order) ?? [];
  const targetSets = todayEnabledExercises.reduce(
    (total, exercise) => total + exercise.targetSets,
    0,
  );
  const definitionMap = new Map(
    exerciseDefinitions.map((definition) => [definition.id, definition]),
  );
  const heroExerciseNames = todayEnabledExercises
    .slice(0, 4)
    .map(
      (exercise) =>
        definitionMap.get(exercise.exerciseId)?.name ?? "Exercise",
    );

  const nextTraining = nextTrainingDay(schedule, today);
  const nextTrainingTemplate = templates.find(
    (template) => template.id === nextTraining?.entry.templateId,
  );

  const unseenAchievement = achievements.find(
    (achievement) =>
      achievement.seenAt === null && achievement.id !== dismissedAchievement,
  );

  const handleStart = async (template: WorkoutTemplate) => {
    if (!profile) return;
    if (activeSession) {
      router.push("/workout/");
      return;
    }
    setStartingId(template.id);
    try {
      const session = await startActiveSession({
        uid: user!.uid,
        template,
        definitions: exerciseDefinitions,
        schedule,
        sessions,
        timezone: profile.timezone,
        now: Date.now(),
      });
      await saveDraftBackup(user!.uid, session);
      router.push("/workout/");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not start the workout. Try again.",
      );
    } finally {
      setStartingId(null);
    }
  };

  const handleDismissAchievement = async (id: string) => {
    setDismissedAchievement(id);
    try {
      await markAchievementSeen(user!.uid, id);
    } catch {
      setDismissedAchievement(null);
      toast.error("Could not dismiss this milestone right now.");
    }
  };

  const handleRestore = async () => {
    setRecoveryBusy(true);
    try {
      await restoreDraft();
      toast.success("Draft restored.");
      router.push("/workout/");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not restore the draft.",
      );
    } finally {
      setRecoveryBusy(false);
    }
  };

  const handleDiscardRecovery = async () => {
    setRecoveryBusy(true);
    try {
      await discardRecoveryDraft();
      toast.success("Local draft discarded.");
    } catch {
      toast.error("Could not discard the local draft.");
    } finally {
      setRecoveryBusy(false);
    }
  };

  if (dataLoading || sessionsLoading || !profile) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-16 w-2/3 rounded-2xl" />
        <div className="skeleton h-64 rounded-panel" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const firstName = (profile.displayName || user?.displayName || "Athlete")
    .trim()
    .split(/\s+/)[0];

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-2">
            {formatDateKey(today, "EEEE, MMMM d")}
          </p>
          <h1 className="display text-[1.95rem] font-semibold leading-none sm:text-[2.35rem]">
            {greetingFor(timezone, now)},{" "}
            <span className="text-muted">{firstName}.</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <RecapButton
            label="Recap"
            initialRange="week"
            iconOnly
            size="icon"
            className="sm:hidden"
            sessions={sessions}
            records={records}
            measurements={measurements}
            definitions={exerciseDefinitions}
            schedule={schedule}
            profile={profile}
            today={today}
          />
          <Button asChild variant="secondary" size="icon" className="sm:hidden">
            <Link href="/workouts/?tab=history" aria-label="Workout history">
              <History />
            </Link>
          </Button>
          <RecapButton
            label="Recap"
            initialRange="week"
            className="hidden sm:inline-flex"
            sessions={sessions}
            records={records}
            measurements={measurements}
            definitions={exerciseDefinitions}
            schedule={schedule}
            profile={profile}
            today={today}
          />
          <Button
            asChild
            variant="secondary"
            className="hidden sm:inline-flex"
          >
            <Link href="/workouts/?tab=history">
              <History /> History
            </Link>
          </Button>
        </div>
      </header>

      {unseenAchievement ? (
        <AchievementBanner
          achievements={
            unseenAchievement ? [unseenAchievement] : []
          }
          timezone={timezone}
          onDismiss={(id) => void handleDismissAchievement(id)}
        />
      ) : null}

      {recoveryDraft ? (
        <RecoveryCard
          savedAt={recoveryDraft.savedAt}
          onRestore={() => void handleRestore()}
          onDiscard={() => void handleDiscardRecovery()}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-panel border border-line bg-surface lg:col-span-2">
          <div className="surface-grid absolute inset-0 opacity-20" aria-hidden />
          <div className="absolute -right-20 -top-24 size-64 rounded-full bg-lime/[0.055] blur-3xl" aria-hidden />
          <div className="relative p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={scheduleEntry?.kind === "rest" ? "default" : "lime"} dot>
                {scheduleEntry?.kind === "rest"
                  ? "Rest day"
                  : scheduleEntry?.kind === "training"
                    ? "Training day"
                    : "Open day"}
              </Badge>
              {extraToday.length > 0 && !scheduledCompleted ? (
                <Badge variant="violet">
                  <Sparkles className="size-3" /> Extra session logged
                </Badge>
              ) : null}
              {activeSession ? (
                <Badge variant="success" dot>
                  Live session
                </Badge>
              ) : null}
            </div>

            {activeSession ? (
              <div className="mt-5">
                <p className="athletic-label text-lime/80">Workout in progress</p>
                <h2 className="display mt-1.5 text-[2.2rem] font-semibold leading-none sm:text-[2.8rem]">
                  {activeSession.templateName}
                </h2>
                <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted">
                  Your active session is saved. Pick up exactly where you left
                  off.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button asChild size="lg">
                    <Link href="/workout/">
                      Resume workout <ArrowRight />
                    </Link>
                  </Button>
                  <span className="text-[11px] text-muted-2">
                    {activeSession.exercises.length} exercises ·{" "}
                    {getSessionSetCounts(activeSession).completed} sets logged
                  </span>
                </div>
              </div>
            ) : displayedCompleted ? (
              <div className="mt-5">
                <p className="athletic-label text-lime/80">
                  {displayedCompleted.source === "extra"
                    ? "Extra session"
                    : "Session complete"}
                </p>
                <h2 className="display mt-1.5 text-[2.2rem] font-semibold leading-none sm:text-[2.8rem]">
                  {displayedCompleted.templateName}
                </h2>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-3.5 text-muted-2" />
                    {formatDurationLong(
                      summaryForSession(displayedCompleted).durationSeconds,
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Dumbbell className="size-3.5 text-muted-2" />
                    {summaryForSession(displayedCompleted).setsCompleted} sets
                  </span>
                  {summaryForSession(displayedCompleted).totalVolumeKg > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Weight className="size-3.5 text-muted-2" />
                      {formatVolume(
                        summaryForSession(displayedCompleted).totalVolumeKg,
                        profile.weightUnit,
                      )}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link
                      href={`/workouts/session/?id=${encodeURIComponent(displayedCompleted.id)}`}
                    >
                      View session <ArrowUpRight />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/workouts/?tab=schedule">See the week</Link>
                  </Button>
                </div>
              </div>
            ) : scheduleEntry?.kind === "training" && todayTemplate ? (
              <div className="mt-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="athletic-label text-lime/80">Today&apos;s focus</p>
                    <h2 className="display mt-1.5 text-[2.5rem] font-semibold leading-none sm:text-[3.25rem]">
                      {todayTemplate.name}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-2xl font-semibold tracking-[-0.04em]">
                      {todayEnabledExercises.length}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-2">
                      exercises
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {todayTemplate.type === "cardio"
                    ? "Log your cardio honestly. Duration, distance, effort."
                    : `${targetSets} target sets · Set the pace, then own it.`}
                </p>
                {todayTemplate.type === "strength" && heroExerciseNames.length > 0 ? (
                  <div className="mt-5 grid gap-1.5 border-y border-line/70 py-3.5">
                    {todayEnabledExercises.slice(0, 4).map((exercise) => {
                      const definition = definitionMap.get(exercise.exerciseId);
                      return (
                        <div
                          key={exercise.id}
                          className="flex items-center justify-between gap-4 text-[12px]"
                        >
                          <span className="truncate text-muted">
                            {definition?.name ?? "Exercise"}
                          </span>
                          <span className="tabular shrink-0 text-muted-2">
                            {exercise.targetSets} × {exercise.targetReps}
                          </span>
                        </div>
                      );
                    })}
                    {todayEnabledExercises.length > 4 ? (
                      <p className="pt-0.5 text-[11px] text-muted-2">
                        + {todayEnabledExercises.length - 4} more exercises
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={() => void handleStart(todayTemplate)}
                    loading={
                      startingId === todayTemplate.id ||
                      activeLoading ||
                      recoveryBusy
                    }
                  >
                    {todayTemplate.type === "cardio" ? "Log cardio" : "Start workout"}
                    <ArrowRight />
                  </Button>
                  <span className="text-[11px] text-muted-2">
                    {sessions.length === 0
                      ? "Your first session starts the record."
                      : "Everything is editable as you go."}
                  </span>
                </div>
              </div>
            ) : scheduleEntry?.kind === "rest" ? (
              <div className="mt-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="athletic-label text-muted-2">Recovery day</p>
                    <h2 className="display mt-1.5 text-[2.35rem] font-semibold leading-none sm:text-[3rem]">
                      Rest is training.
                    </h2>
                    <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted">
                      Let the work settle. Streaks skip rest days — the plan
                      already accounts for it.
                    </p>
                  </div>
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-elevated text-muted">
                    <Moon className="size-6" />
                  </span>
                </div>
                {nextTraining && nextTrainingTemplate ? (
                  <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-canvas-soft/60 p-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-elevated text-lime">
                      <Dumbbell className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-ink">
                        Next: {nextTraining.entry.templateName}
                      </p>
                      <p className="text-[11px] text-muted-2">
                        {formatDateKey(nextTraining.date, "EEEE, MMM d")}
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/workouts/?tab=schedule">Week <ChevronRight /></Link>
                    </Button>
                  </div>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="secondary">
                    <Link href="/workouts/?tab=templates">Train anyway</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <p className="athletic-label text-muted-2">No plan assigned</p>
                <h2 className="display mt-1.5 text-[2.2rem] font-semibold leading-none">
                  Make today count.
                </h2>
                <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted">
                  Choose one of your templates to train, or set up this
                  weekday&apos;s plan.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/workouts/?tab=templates">
                    Choose a workout <ArrowRight />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="athletic-label">Consistency</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="tabular text-[2.6rem] font-semibold leading-none tracking-[-0.05em]">
                  {streakStats.current}
                </span>
                <span className="pb-1 text-sm text-muted">
                  training-day streak
                </span>
              </div>
            </div>
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl border",
                streakStats.current > 0
                  ? "border-lime/20 bg-lime/10 text-lime"
                  : "border-line bg-elevated text-muted-2",
              )}
            >
              <Flame className="size-5" />
            </span>
          </div>
          <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
            {streakStats.current > 0
              ? "Rest days never break it. One honest session keeps it alive."
              : "Your streak starts with the next scheduled session. Rest days are exempt."}
          </p>
          <div className="mt-5 flex items-center gap-5 border-t border-line/70 pt-4">
            <MetricRing
              value={streakStats.weeklyConsistency}
              label="weekly consistency"
              sublabel="This week"
            />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-2">
                  This week
                </p>
                <p className="tabular mt-0.5 text-sm font-semibold">
                  {streakStats.completedThisWeek}{" "}
                  <span className="font-normal text-muted">
                    / {streakStats.plannedThisWeek}{" "}
                    {streakStats.plannedThisWeek === 1
                      ? "session"
                      : "sessions"}
                  </span>
                </p>
              </div>
              <div className="flex gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-2">Best</p>
                  <p className="tabular text-sm font-semibold">
                    {streakStats.longest}{" "}
                    {streakStats.longest === 1 ? "day" : "days"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-2">All time</p>
                  <p className="tabular text-sm font-semibold">
                    {sessions.length} logged
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <section className="mt-4 rounded-panel border border-line bg-surface p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold">Your week</h2>
            <p className="mt-0.5 text-[11px] text-muted-2">Rest days are part of the plan.</p>
          </div>
          <Link
            href="/progress/"
            className="flex min-h-11 items-center gap-1 text-[11px] font-medium text-muted transition-colors hover:text-lime"
          >
            Calendar <ChevronRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekAttendance.map((day) => {
            const isToday = day.date === today;
            return (
              <div
                key={day.date}
                className={cn(
                  "relative flex min-w-0 flex-col items-center rounded-xl border px-1 py-2.5 text-center transition-colors sm:py-3",
                  isToday
                    ? "border-lime/40 bg-lime/[0.07]"
                    : day.status === "completed"
                      ? "border-line bg-canvas-soft"
                      : "border-transparent bg-canvas-soft/50",
                  day.status === "missed" && "opacity-55",
                )}
              >
                <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-2 sm:text-[10px]">
                  {WEEKDAY_SHORT[day.day]}
                </span>
                <span
                  className={cn(
                    "tabular mt-1 text-sm font-semibold sm:text-[15px]",
                    isToday ? "text-lime" : "text-ink",
                  )}
                >
                  {Number(day.date.slice(8))}
                </span>
                <span className="mt-1.5 flex size-4 items-center justify-center">
                  {day.status === "completed" ? (
                    <Check className="size-3.5 text-lime" />
                  ) : day.kind === "rest" ? (
                    <Moon className="size-3 text-muted-2" />
                  ) : day.status === "missed" ? (
                    <X className="size-3 text-danger/70" />
                  ) : (
                    <span className="size-1.5 rounded-full border border-line-strong" />
                  )}
                </span>
                {day.hasExtraSession ? (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-violet" />
                ) : null}
              </div>
            );
          })}
        </div>
        {nextTraining && nextTrainingTemplate ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-line/70 bg-canvas-soft/35 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated text-lime">
              <Dumbbell className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-2">
                Next up
              </p>
              <p className="mt-0.5 truncate text-[12px] font-semibold text-ink">
                {nextTrainingTemplate.name}
              </p>
            </div>
            <span className="shrink-0 text-right text-[10px] text-muted-2">
              {formatDateKey(nextTraining.date, "EEE, MMM d")}
            </span>
            <Button asChild variant="ghost" size="icon">
              <Link
                href="/workouts/?tab=schedule"
                aria-label="Open weekly schedule"
              >
                <ChevronRight />
              </Link>
            </Button>
          </div>
        ) : null}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Workouts"
          value={weekSessions.length}
          hint="Logged this week"
          icon={<Dumbbell className="size-4" />}
          accent="lime"
        />
        <StatTile
          label="Sets"
          value={weekSets}
          hint="Completed this week"
          icon={<Target className="size-4" />}
        />
        <StatTile
          label="Reps"
          value={weekReps}
          hint="Recorded this week"
          icon={<Plus className="size-4" />}
          accent="blue"
        />
        <StatTile
          label="Volume"
          value={formatVolume(weekVolume, profile.weightUnit)}
          hint="Numeric sets only"
          icon={<Weight className="size-4" />}
          accent="violet"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section>
          <SectionHeading
            title="Recent records"
            description="8-rep marks and volume. No estimated maxes."
            action={
              <Link
                href="/progress/"
                className="inline-flex min-h-11 items-center text-[11px] font-medium text-muted transition-colors hover:text-lime"
              >
                All records
              </Link>
            }
          />
          <Card className="h-[calc(100%-2.5rem)] p-2">
            {recentRecords.length > 0 ? (
              <div className="divide-y divide-line/60">
                {recentRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 px-2.5 py-3.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-elevated text-lime">
                      <Trophy className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-ink">
                        {record.exerciseName}
                      </p>
                      <p className="truncate text-[10px] text-muted-2">
                        {formatRecordSecondary(record, profile.weightUnit)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-[12px] font-semibold text-lime">
                        {formatRecordValue(record, profile.weightUnit)}
                      </p>
                      <p className="text-[10px] text-muted-2">
                        {formatTimestamp(record.achievedAt, timezone, "MMM d")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                className="border-0 bg-transparent"
                icon={<Trophy className="size-5" />}
                title="Records arrive with honest sets"
                description="Finish a strength workout and FORGE will mark your first real records automatically."
              />
            )}
          </Card>
        </section>

        <section>
          <SectionHeading
            title="Latest session"
            description={
              latestWorkout
                ? formatDateKey(latestWorkout.scheduledDate, "EEEE, MMM d")
                : "Your history starts with the first set."
            }
            action={
              <Link
                href="/workouts/?tab=history"
                className="text-[11px] font-medium text-muted transition-colors hover:text-lime"
              >
                History
              </Link>
            }
          />
          {latestWorkout ? (
            <Link
              href={`/workouts/session/?id=${encodeURIComponent(latestWorkout.id)}`}
              className="block rounded-panel border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-elevated/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant={latestWorkout.workoutType === "cardio" ? "blue" : "lime"} dot>
                    {latestWorkout.templateName}
                  </Badge>
                  <p className="mt-3 text-[13px] text-muted">
                    {summaryForSession(latestWorkout).setsCompleted} sets ·{" "}
                    {formatDurationLong(
                      summaryForSession(latestWorkout).durationSeconds,
                    )}
                    {summaryForSession(latestWorkout).totalVolumeKg > 0
                      ? ` · ${formatVolume(
                          summaryForSession(latestWorkout).totalVolumeKg,
                          profile.weightUnit,
                        )}`
                      : ""}
                  </p>
                </div>
                <span className="flex size-9 items-center justify-center rounded-xl border border-line bg-elevated text-muted">
                  <ArrowUpRight className="size-4" />
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {latestWorkout.exercises.slice(0, 4).map((exercise) => (
                  <span
                    key={exercise.id}
                    className="max-w-full truncate rounded-lg border border-line bg-canvas-soft px-2 py-1 text-[10px] text-muted"
                  >
                    {exercise.name}
                  </span>
                ))}
                {latestWorkout.exercises.length > 4 ? (
                  <span className="rounded-lg px-2 py-1 text-[10px] text-muted-2">
                    +{latestWorkout.exercises.length - 4}
                  </span>
                ) : null}
              </div>
            </Link>
          ) : (
            <EmptyState
              icon={<Dumbbell className="size-5" />}
              title="No sessions yet"
              description="Start today's workout and this space becomes the record."
            />
          )}
        </section>
      </div>

      <section className="mt-4 rounded-panel border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="athletic-label">Body weight</p>
            {latestWeight ? (
              <div className="mt-2 flex items-end gap-2">
                <span className="tabular text-2xl font-semibold tracking-[-0.04em]">
                  {formatWeight(latestWeight.value, profile.weightUnit)}
                </span>
                {weightChange !== null ? (
                  <span
                    className={cn(
                      "pb-1 text-[11px] font-medium",
                      weightChange === 0
                        ? "text-muted"
                        : weightChange > 0
                          ? "text-warning"
                          : "text-success",
                    )}
                  >
                    {formatDeltaWeight(weightChange, profile.weightUnit)} since last log
                  </span>
                ) : (
                  <span className="pb-1 text-[11px] text-muted-2">
                    Baseline logged
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                No body measurements logged yet.
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-2">
              Profile baseline: {formatWeight(profile.weightKg, profile.weightUnit)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {weightMeasurements.length >= 2 ? (
              <Sparkline
                values={weightMeasurements.slice(-12).map((entry) => entry.value)}
                className="h-10 w-28"
              />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-xl border border-line bg-elevated text-muted">
                <Scale className="size-5" />
              </span>
            )}
            <Button asChild variant="secondary">
              <Link href="/body/">Log weight</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
