import type {
  BodyMeasurement,
  ExerciseDefinition,
  PersonalRecord,
  PersonalRecordMetric,
  Profile,
  ScheduleEntry,
  SessionExercise,
  SessionSet,
  SummaryPr,
  WeightUnit,
  WorkoutSession,
} from "./types";
import {
  addDaysToKey,
  buildAttendance,
  calculateStreakStats,
  dateKeyInTimeZone,
  diffDateKeys,
  formatDateKey,
  startOfMonthKey,
  startOfWeekKey,
  weekdayForDateKey,
} from "./dates";
import {
  getSessionSetCounts,
  getTotalCompletedReps,
  getTotalVolumeKg,
} from "./workout";
import {
  formatDeltaWeight,
  formatVolume,
  formatWeight,
  round,
} from "./units";

export type RecapRange = "week" | "month" | "30d" | "all";
export type LiftBoardRange = "4w" | "8w" | "12w" | "all";
export type ExerciseCategory = ExerciseDefinition["category"];

export interface DateRange {
  start: string;
  end: string;
  previousStart: string | null;
  previousEnd: string | null;
}

export interface ExerciseProgressPoint {
  date: string;
  weightKg: number;
  reps: number;
  volumeKg: number;
  sessionId: string;
}

export interface ExerciseProgressRow {
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  lastDate: string;
  lastSessionId: string;
  bestWeightKg: number | null;
  bestReps: number | null;
  bestDate: string | null;
  previousBestKg: number | null;
  deltaKg: number | null;
  sessionCount: number;
  trend: ExerciseProgressPoint[];
  recent: ExerciseProgressPoint[];
}

export type RecapLift = ExerciseProgressRow;

export interface RecapPr {
  metric: PersonalRecordMetric;
  label: string;
  value: number;
  unit: string;
  previousValue: number | null;
  exerciseId: string | null;
  exerciseName: string;
  date: string;
  scopeKey: string;
  weightKg: number | null;
  reps: number | null;
}

export interface RecapPrGroup {
  exerciseId: string | null;
  exerciseName: string;
  metrics: RecapPr[];
}

export interface MuscleBalanceRow {
  category: ExerciseCategory;
  label: string;
  sets: number;
  weeklyAverage: number;
  targetMin: number;
  targetMax: number;
}

export interface RecapSessionMeta {
  id: string;
  title: string;
  date: string;
  durationSeconds: number;
  sets: number;
  reps: number;
  volumeKg: number;
  notes: string;
}

export interface RecapComparison {
  volumePct: number | null;
  previousVolumeKg: number | null;
  sessionDelta: number | null;
  previousSessionCount: number | null;
}

export interface RecapData {
  scope: "period" | "session";
  range: RecapRange;
  weightUnit: WeightUnit;
  periodLabel: string;
  periodSubLabel: string;
  startDate: string;
  endDate: string;
  sessions: number;
  plannedSessions: number | null;
  sets: number;
  reps: number;
  volumeKg: number;
  durationSeconds: number;
  prGroups: RecapPrGroup[];
  topLifts: ExerciseProgressRow[];
  attentionLifts: ExerciseProgressRow[];
  muscleBalance: MuscleBalanceRow[];
  bodyWeightStartKg: number | null;
  bodyWeightEndKg: number | null;
  bodyWeightChangeKg: number | null;
  streak: number | null;
  headline: string;
  focus: string;
  comparison: RecapComparison;
  session: RecapSessionMeta | null;
}

export interface RecapInput {
  sessions: WorkoutSession[];
  records: PersonalRecord[];
  measurements: BodyMeasurement[];
  definitions: ExerciseDefinition[];
  schedule: ScheduleEntry[];
  profile: Profile | null;
  today: string;
  range: RecapRange;
}

export interface SessionRecapInput {
  session: WorkoutSession;
  previousSession: WorkoutSession | null;
  definitions: ExerciseDefinition[];
  profile: Profile | null;
  measurements: BodyMeasurement[];
}

export interface ExerciseProgressInput {
  sessions: WorkoutSession[];
  definitions: ExerciseDefinition[];
  start: string;
  end: string;
  previousStart?: string | null;
  previousEnd?: string | null;
  targetReps?: number;
}

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  core: "Core",
  cardio: "Cardio",
  other: "Other",
};

const MUSCLE_TARGETS: Record<
  "push" | "pull" | "legs" | "core",
  { min: number; max: number }
> = {
  push: { min: 8, max: 20 },
  pull: { min: 8, max: 20 },
  legs: { min: 8, max: 20 },
  core: { min: 4, max: 12 },
};

const PR_PRIORITY: Record<PersonalRecordMetric, number> = {
  maxWeight: 0,
  repsAtWeight: 1,
  exerciseVolume: 2,
  targetPerformance: 3,
  sessionVolume: 4,
  estimated1RM: 99,
};

export const RECAP_RANGE_LABELS: Record<RecapRange, string> = {
  week: "This week",
  month: "This month",
  "30d": "Last 30 days",
  all: "All time",
};

export const LIFT_BOARD_RANGE_LABELS: Record<LiftBoardRange, string> = {
  "4w": "4 weeks",
  "8w": "8 weeks",
  "12w": "12 weeks",
  all: "All time",
};

function completedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((session) => session.status === "completed")
    .sort(
      (a, b) =>
        (a.completedAt ?? a.startedAt) -
        (b.completedAt ?? b.startedAt),
    );
}

function sortSessionsAscending(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort(
    (a, b) =>
      a.scheduledDate.localeCompare(b.scheduledDate) ||
      (a.completedAt ?? a.startedAt) - (b.completedAt ?? b.startedAt),
  );
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function rangeWeeks(start: string, end: string): number {
  return Math.max(1, (diffDateKeys(start, end) + 1) / 7);
}

function formatRange(start: string, end: string): string {
  if (start === end) return formatDateKey(start, "EEE, MMM d");
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  return `${formatDateKey(start, startYear === endYear ? "MMM d" : "MMM d, yyyy")} – ${formatDateKey(
    end,
    endYear === startYear ? "MMM d" : "MMM d, yyyy",
  )}`;
}

function categoryOf(
  definitions: ExerciseDefinition[],
  exerciseId: string,
): ExerciseCategory {
  return definitions.find((definition) => definition.id === exerciseId)
    ?.category ?? "other";
}

function definitionMap(
  definitions: ExerciseDefinition[],
): Map<string, ExerciseDefinition> {
  return new Map(definitions.map((definition) => [definition.id, definition]));
}

function numericCompletedSets(exercise: SessionExercise): SessionSet[] {
  return exercise.sets.filter(
    (set) =>
      set.status === "completed" &&
      set.weightKg !== null &&
      set.reps !== null &&
      Number.isFinite(set.weightKg) &&
      Number.isFinite(set.reps) &&
      set.weightKg > 0 &&
      set.reps > 0,
  );
}

/**
 * Prefer an exact rep target, then a heavier rep count, then any completed
 * numeric set. This keeps the app useful if an 8-rep session is interrupted or
 * a rep or two is added, without pretending the load is an estimated max.
 */
export function bestSetForRepTarget(
  exercise: SessionExercise,
  targetReps = 8,
): { weightKg: number; reps: number; volumeKg: number } | null {
  const completed = numericCompletedSets(exercise);
  if (completed.length === 0) return null;
  const exact = completed.filter((set) => set.reps === targetReps);
  const atLeast = completed.filter((set) => (set.reps ?? 0) >= targetReps);
  const pool = exact.length > 0 ? exact : atLeast.length > 0 ? atLeast : completed;
  const best = pool.reduce((current, set) => {
    const currentScore = (current.weightKg ?? 0) * 10_000 + (current.reps ?? 0);
    const setScore = (set.weightKg ?? 0) * 10_000 + (set.reps ?? 0);
    return setScore > currentScore ? set : current;
  }, pool[0]);
  if (best.weightKg === null || best.reps === null) return null;
  return {
    weightKg: best.weightKg,
    reps: best.reps,
    volumeKg: round(best.weightKg * best.reps, 4),
  };
}

export function bestSetForSessionExercise(
  session: WorkoutSession,
  exerciseId: string,
  targetReps = 8,
): { weightKg: number; reps: number; volumeKg: number; date: string; sessionId: string } | null {
  const exercise = session.exercises.find(
    (candidate) => candidate.exerciseId === exerciseId,
  );
  if (!exercise) return null;
  const best = bestSetForRepTarget(exercise, targetReps);
  if (!best) return null;
  return {
    ...best,
    date: session.scheduledDate,
    sessionId: session.id,
  };
}

function bestForExerciseInSessions(
  sessions: WorkoutSession[],
  exerciseId: string,
  targetReps: number,
): { weightKg: number; reps: number; volumeKg: number; date: string; sessionId: string } | null {
  let best: {
    weightKg: number;
    reps: number;
    volumeKg: number;
    date: string;
    sessionId: string;
  } | null = null;
  for (const session of sessions) {
    const candidate = bestSetForSessionExercise(session, exerciseId, targetReps);
    if (!candidate) continue;
    if (
      !best ||
      candidate.weightKg > best.weightKg ||
      (candidate.weightKg === best.weightKg && candidate.reps > best.reps)
    ) {
      best = candidate;
    }
  }
  return best;
}

function progressPointsForExercise(
  sessions: WorkoutSession[],
  exerciseId: string,
  targetReps: number,
): ExerciseProgressPoint[] {
  const byDate = new Map<string, ExerciseProgressPoint>();
  for (const session of sessions) {
    const best = bestSetForSessionExercise(session, exerciseId, targetReps);
    if (!best) continue;
    const existing = byDate.get(best.date);
    if (
      !existing ||
      best.weightKg > existing.weightKg ||
      (best.weightKg === existing.weightKg && best.reps > existing.reps)
    ) {
      byDate.set(best.date, {
        date: best.date,
        weightKg: best.weightKg,
        reps: best.reps,
        volumeKg: best.volumeKg,
        sessionId: best.sessionId,
      });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildExerciseProgressRows({
  sessions,
  definitions,
  start,
  end,
  previousStart = null,
  previousEnd = null,
  targetReps = 8,
}: ExerciseProgressInput): ExerciseProgressRow[] {
  const completed = sortSessionsAscending(completedSessions(sessions));
  const current = completed.filter((session) =>
    inRange(session.scheduledDate, start, end),
  );
  const previous =
    previousStart && previousEnd
      ? completed.filter((session) =>
          inRange(session.scheduledDate, previousStart, previousEnd),
        )
      : [];
  const defs = definitionMap(definitions);
  const exerciseNames = new Map<string, string>();

  for (const session of [...previous, ...current]) {
    for (const exercise of session.exercises) {
      exerciseNames.set(exercise.exerciseId, exercise.name);
    }
  }

  const rows: ExerciseProgressRow[] = [];
  for (const [exerciseId, name] of exerciseNames) {
    const currentBest = bestForExerciseInSessions(current, exerciseId, targetReps);
    const previousBest = bestForExerciseInSessions(previous, exerciseId, targetReps);
    if (!currentBest && !previousBest) continue;

    const currentPoints = progressPointsForExercise(current, exerciseId, targetReps);
    const allPoints = progressPointsForExercise([...current, ...previous], exerciseId, targetReps);
    const last = allPoints.at(-1);
    const definition = defs.get(exerciseId);

    rows.push({
      exerciseId,
      name: definition?.name ?? name,
      category: definition?.category ?? "other",
      lastDate: last?.date ?? currentBest?.date ?? previousBest?.date ?? end,
      lastSessionId: last?.sessionId ?? currentBest?.sessionId ?? previousBest?.sessionId ?? "",
      bestWeightKg: currentBest?.weightKg ?? null,
      bestReps: currentBest?.reps ?? null,
      bestDate: currentBest?.date ?? null,
      previousBestKg: previousBest?.weightKg ?? null,
      deltaKg:
        currentBest && previousBest
          ? round(currentBest.weightKg - previousBest.weightKg, 2)
          : null,
      sessionCount: currentPoints.length,
      trend: currentPoints,
      recent: currentPoints.slice(-6).reverse(),
    });
  }

  return rows.sort(
    (a, b) =>
      b.lastDate.localeCompare(a.lastDate) ||
      (b.bestWeightKg ?? 0) - (a.bestWeightKg ?? 0) ||
      a.name.localeCompare(b.name),
  );
}

export function liftBoardBounds(
  range: LiftBoardRange,
  today: string,
  sessions: WorkoutSession[],
): DateRange {
  if (range === "all") {
    const dates = completedSessions(sessions)
      .map((session) => session.scheduledDate)
      .sort();
    return {
      start: dates[0] ?? today,
      end: today,
      previousStart: null,
      previousEnd: null,
    };
  }
  const days = range === "4w" ? 28 : range === "8w" ? 56 : 84;
  const start = addDaysToKey(today, -(days - 1));
  const previousEnd = addDaysToKey(start, -1);
  const previousStart = addDaysToKey(previousEnd, -(days - 1));
  return { start, end: today, previousStart, previousEnd };
}

export function recapBounds(
  range: RecapRange,
  today: string,
  profile: Profile | null,
  sessions: WorkoutSession[],
): DateRange {
  if (range === "week") {
    const start = startOfWeekKey(today);
    const previousStart = addDaysToKey(start, -7);
    return {
      start,
      end: today,
      previousStart,
      previousEnd: addDaysToKey(previousStart, diffDateKeys(start, today)),
    };
  }
  if (range === "month") {
    const start = startOfMonthKey(today);
    const previousStart = startOfMonthKey(addDaysToKey(start, -1));
    return {
      start,
      end: today,
      previousStart,
      previousEnd: addDaysToKey(previousStart, diffDateKeys(start, today)),
    };
  }
  if (range === "30d") {
    const start = addDaysToKey(today, -29);
    const previousEnd = addDaysToKey(start, -1);
    return {
      start,
      end: today,
      previousStart: addDaysToKey(previousEnd, -29),
      previousEnd,
    };
  }
  const earliest = [...sessions]
    .filter((session) => session.status === "completed")
    .map((session) => session.scheduledDate)
    .sort()[0];
  const created = profile
    ? dateKeyInTimeZone(profile.createdAt, profile.timezone)
    : today;
  return {
    start: earliest && earliest < created ? earliest : created,
    end: today,
    previousStart: null,
    previousEnd: null,
  };
}

function plannedTrainingDays(
  schedule: ScheduleEntry[],
  start: string,
  end: string,
): number | null {
  if (schedule.length === 0) return null;
  let count = 0;
  for (let date = start; date <= end; date = addDaysToKey(date, 1)) {
    const day = weekdayForDateKey(date);
    const entry = schedule.find((candidate) => candidate.day === day);
    if (entry?.kind === "training") count += 1;
  }
  return count;
}

export function prFromRecord(record: PersonalRecord): RecapPr {
  return {
    metric: record.metric,
    label: record.exerciseName || "Session record",
    value: record.value,
    unit: record.unit,
    previousValue: record.previousValue,
    exerciseId: record.exerciseId,
    exerciseName: record.exerciseName || "Full session",
    date: record.scheduledDate,
    scopeKey: record.scopeKey,
    weightKg: record.weightKg,
    reps: record.reps,
  };
}

export function prFromSummary(
  pr: SummaryPr,
  date: string,
): RecapPr {
  return {
    metric: pr.metric,
    label: pr.label,
    value: pr.value,
    unit: pr.unit,
    previousValue: pr.previousValue,
    exerciseId: pr.exerciseId,
    exerciseName: pr.exerciseName || "Full session",
    date,
    scopeKey: pr.scopeKey,
    weightKg: null,
    reps: null,
  };
}

export function groupRecapPrs(prs: RecapPr[]): RecapPrGroup[] {
  const groups = new Map<string, RecapPrGroup>();
  for (const pr of prs) {
    if (pr.metric === "estimated1RM") continue;
    const key = pr.exerciseId ?? "session";
    const group = groups.get(key) ?? {
      exerciseId: pr.exerciseId,
      exerciseName: pr.exerciseName,
      metrics: [],
    };
    if (
      !group.metrics.some(
        (metric) => metric.metric === pr.metric && metric.scopeKey === pr.scopeKey,
      )
    ) {
      group.metrics.push(pr);
    }
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      metrics: group.metrics.sort(
        (a, b) => PR_PRIORITY[a.metric] - PR_PRIORITY[b.metric],
      ),
    }))
    .sort(
      (a, b) =>
        PR_PRIORITY[a.metrics[0]?.metric ?? "sessionVolume"] -
          PR_PRIORITY[b.metrics[0]?.metric ?? "sessionVolume"] ||
        b.metrics.length - a.metrics.length ||
        a.exerciseName.localeCompare(b.exerciseName),
    );
}

function bodyWeightChange(
  measurements: BodyMeasurement[],
  start: string,
  end: string,
): { startKg: number | null; endKg: number | null; changeKg: number | null } {
  const weights = measurements
    .filter(
      (measurement) =>
        measurement.metric === "bodyWeight" &&
        inRange(measurement.date, start, end),
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
    );
  if (weights.length === 0) {
    return { startKg: null, endKg: null, changeKg: null };
  }
  const first = weights[0];
  const last = weights.at(-1) ?? first;
  return {
    startKg: first.value,
    endKg: last.value,
    changeKg:
      weights.length > 1 ? round(last.value - first.value, 2) : null,
  };
}

export function buildMuscleBalance({
  sessions,
  definitions,
  start,
  end,
}: {
  sessions: WorkoutSession[];
  definitions: ExerciseDefinition[];
  start: string;
  end: string;
}): MuscleBalanceRow[] {
  const categories: Array<"push" | "pull" | "legs" | "core"> = [
    "push",
    "pull",
    "legs",
    "core",
  ];
  const counts = new Map<string, number>(categories.map((category) => [category, 0]));
  const weeks = rangeWeeks(start, end);
  for (const session of sessions) {
    if (!inRange(session.scheduledDate, start, end)) continue;
    for (const exercise of session.exercises) {
      const category = categoryOf(definitions, exercise.exerciseId);
      if (!categories.includes(category as (typeof categories)[number])) continue;
      const sets = exercise.sets.filter((set) => set.status === "completed").length;
      counts.set(category, (counts.get(category) ?? 0) + sets);
    }
  }
  return categories.map((category) => {
    const sets = counts.get(category) ?? 0;
    const target = MUSCLE_TARGETS[category];
    return {
      category,
      label: CATEGORY_LABELS[category],
      sets,
      weeklyAverage: round(sets / weeks, 1),
      targetMin: target.min,
      targetMax: target.max,
    };
  });
}

function focusForRecap({
  sessions,
  prGroups,
  attentionLifts,
  muscleBalance,
  planned,
  completed,
}: {
  sessions: number;
  prGroups: RecapPrGroup[];
  attentionLifts: ExerciseProgressRow[];
  muscleBalance: MuscleBalanceRow[];
  planned: number | null;
  completed: number;
}): string {
  if (sessions === 0) {
    return "No sessions in this window. Put one honest session on the board and the next recap has something to work with.";
  }
  const lowGroup = [...muscleBalance]
    .filter((row) => row.sets > 0 && row.weeklyAverage < row.targetMin)
    .sort((a, b) => a.weeklyAverage - b.weeklyAverage)[0];
  if (lowGroup) {
    return `${lowGroup.label} is under its usual weekly range. Give it the next slot and keep the rest of the week intact.`;
  }
  if (attentionLifts.length > 0) {
    return `${attentionLifts[0].name} is flat against the previous window. Same load, cleaner 8s, then add the smallest jump.`;
  }
  if (prGroups.length > 0) {
    return "Protect the new bests. Match the top set next time, then chase one more clean rep before adding load.";
  }
  if (planned !== null && completed < planned) {
    return `${completed} of ${planned} due sessions completed. One more session next week is the highest-leverage change.`;
  }
  return "Keep the top sets moving. Add a rep or the smallest load jump, not both at once.";
}

export function buildRecap({
  sessions,
  records,
  measurements,
  definitions,
  schedule,
  profile,
  today,
  range,
}: RecapInput): RecapData {
  const bounds = recapBounds(range, today, profile, sessions);
  const current = completedSessions(sessions).filter((session) =>
    inRange(session.scheduledDate, bounds.start, bounds.end),
  );
  const previous =
    bounds.previousStart && bounds.previousEnd
      ? completedSessions(sessions).filter((session) =>
          inRange(
            session.scheduledDate,
            bounds.previousStart!,
            bounds.previousEnd!,
          ),
        )
      : [];
  const sets = current.reduce(
    (total, session) => total + getSessionSetCounts(session).completed,
    0,
  );
  const reps = current.reduce(
    (total, session) => total + getTotalCompletedReps(session),
    0,
  );
  const volumeKg = current.reduce(
    (total, session) =>
      total + (session.summary?.totalVolumeKg ?? getTotalVolumeKg(session)),
    0,
  );
  const previousVolumeKg = previous.reduce(
    (total, session) =>
      total + (session.summary?.totalVolumeKg ?? getTotalVolumeKg(session)),
    0,
  );
  const durationSeconds = current.reduce(
    (total, session) =>
      total +
      (session.summary?.durationSeconds ??
        Math.max(
          0,
          Math.floor(
            ((session.completedAt ?? session.updatedAt) - session.startedAt) / 1000,
          ),
        )),
    0,
  );
  const planned = range === "all" ? null : plannedTrainingDays(schedule, bounds.start, bounds.end);
  const progressRows = buildExerciseProgressRows({
    sessions,
    definitions,
    start: bounds.start,
    end: bounds.end,
    previousStart: bounds.previousStart,
    previousEnd: bounds.previousEnd,
  });
  const topLifts = [...progressRows]
    .filter((row) => row.bestWeightKg !== null)
    .sort(
      (a, b) =>
        (b.deltaKg ?? -Infinity) - (a.deltaKg ?? -Infinity) ||
        (b.bestWeightKg ?? 0) - (a.bestWeightKg ?? 0),
    )
    .slice(0, 4);
  const attentionLifts = progressRows
    .filter(
      (row) =>
        row.previousBestKg !== null &&
        (row.bestWeightKg === null || row.bestWeightKg <= row.previousBestKg),
    )
    .sort((a, b) => (a.deltaKg ?? 0) - (b.deltaKg ?? 0))
    .slice(0, 3);
  // Session summaries preserve the PRs that were new on the day, even if a
  // later session has since beaten them. Fall back to all-time records for
  // older sessions that predate saved summaries.
  const prByKey = new Map<string, RecapPr>();
  for (const session of current) {
    for (const pr of session.summary?.prs ?? []) {
      const recapPr = prFromSummary(pr, session.scheduledDate);
      const key = `${recapPr.exerciseId ?? "session"}-${recapPr.metric}-${recapPr.scopeKey}`;
      const existing = prByKey.get(key);
      if (!existing || recapPr.value > existing.value) {
        prByKey.set(key, recapPr);
      }
    }
  }
  const prs =
    prByKey.size > 0
      ? [...prByKey.values()]
      : records
          .filter((record) =>
            inRange(record.scheduledDate, bounds.start, bounds.end),
          )
          .map(prFromRecord);
  const prGroups = groupRecapPrs(prs);
  const muscleBalance = buildMuscleBalance({
    sessions,
    definitions,
    start: bounds.start,
    end: bounds.end,
  });
  const body = bodyWeightChange(measurements, bounds.start, bounds.end);
  const streak = calculateStreakStats(
    buildAttendance(
      profile
        ? dateKeyInTimeZone(profile.createdAt, profile.timezone)
        : bounds.start,
      today,
      today,
      schedule,
      sessions,
    ),
    today,
    startOfWeekKey(today),
  ).current;
  const comparison: RecapComparison = {
    previousVolumeKg: previous.length > 0 ? round(previousVolumeKg, 2) : null,
    volumePct:
      previousVolumeKg > 0
        ? round(((volumeKg - previousVolumeKg) / previousVolumeKg) * 100, 1)
        : null,
    previousSessionCount: previous.length > 0 ? previous.length : null,
    sessionDelta: previous.length > 0 ? current.length - previous.length : null,
  };
  const periodLabel = RECAP_RANGE_LABELS[range];
  const sessionLabel = `${current.length} session${current.length === 1 ? "" : "s"}`;
  return {
    scope: "period",
    range,
    weightUnit: profile?.weightUnit ?? "kg",
    periodLabel,
    periodSubLabel: formatRange(bounds.start, bounds.end),
    startDate: bounds.start,
    endDate: bounds.end,
    sessions: current.length,
    plannedSessions: planned,
    sets,
    reps,
    volumeKg: round(volumeKg, 2),
    durationSeconds,
    prGroups,
    topLifts,
    attentionLifts,
    muscleBalance,
    bodyWeightStartKg: body.startKg,
    bodyWeightEndKg: body.endKg,
    bodyWeightChangeKg: body.changeKg,
    streak,
    headline: `${sessionLabel} · ${formatVolume(volumeKg, profile?.weightUnit ?? "kg")} · ${prGroups.length} PR lift${prGroups.length === 1 ? "" : "s"}`,
    focus: focusForRecap({
      sessions: current.length,
      prGroups,
      attentionLifts,
      muscleBalance,
      planned,
      completed: current.length,
    }),
    comparison,
    session: null,
  };
}

export function buildSessionRecap({
  session,
  previousSession,
  definitions,
  profile,
  measurements,
}: SessionRecapInput): RecapData {
  const summary = session.summary;
  const sets = summary?.setsCompleted ?? getSessionSetCounts(session).completed;
  const reps = summary?.totalReps ?? getTotalCompletedReps(session);
  const volumeKg = summary?.totalVolumeKg ?? getTotalVolumeKg(session);
  const durationSeconds =
    summary?.durationSeconds ??
    Math.max(
      0,
      Math.floor(((session.completedAt ?? session.updatedAt) - session.startedAt) / 1000),
    );
  const prs = (summary?.prs ?? []).map((pr) => prFromSummary(pr, session.scheduledDate));
  const prGroups = groupRecapPrs(prs);
  const topLifts = session.exercises
    .map((exercise): ExerciseProgressRow | null => {
      const best = bestSetForSessionExercise(session, exercise.exerciseId);
      if (!best) return null;
      const previousBest = previousSession
        ? bestSetForSessionExercise(previousSession, exercise.exerciseId)
        : null;
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        category: categoryOf(definitions, exercise.exerciseId),
        lastDate: session.scheduledDate,
        lastSessionId: session.id,
        bestWeightKg: best.weightKg,
        bestReps: best.reps,
        bestDate: session.scheduledDate,
        previousBestKg: previousBest?.weightKg ?? null,
        deltaKg: previousBest
          ? round(best.weightKg - previousBest.weightKg, 2)
          : null,
        sessionCount: 1,
        trend: [
          {
            date: session.scheduledDate,
            weightKg: best.weightKg,
            reps: best.reps,
            volumeKg: best.volumeKg,
            sessionId: session.id,
          },
        ],
        recent: [
          {
            date: session.scheduledDate,
            weightKg: best.weightKg,
            reps: best.reps,
            volumeKg: best.volumeKg,
            sessionId: session.id,
          },
        ],
      } satisfies ExerciseProgressRow;
    })
    .filter((row): row is ExerciseProgressRow => row !== null)
    .sort((a, b) => (b.bestWeightKg ?? 0) - (a.bestWeightKg ?? 0))
    .slice(0, 4);
  const muscleBalance = buildMuscleBalance({
    sessions: [session],
    definitions,
    start: session.scheduledDate,
    end: session.scheduledDate,
  });
  const previousVolume = previousSession
    ? previousSession.summary?.totalVolumeKg ?? getTotalVolumeKg(previousSession)
    : null;
  const body = measurements
    .filter(
      (measurement) =>
        measurement.metric === "bodyWeight" &&
        measurement.date <= session.scheduledDate,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .at(-1);
  return {
    scope: "session",
    range: "week",
    weightUnit: profile?.weightUnit ?? "kg",
    periodLabel: session.templateName,
    periodSubLabel: formatDateKey(session.scheduledDate, "EEEE, MMM d"),
    startDate: session.scheduledDate,
    endDate: session.scheduledDate,
    sessions: 1,
    plannedSessions: 1,
    sets,
    reps,
    volumeKg: round(volumeKg, 2),
    durationSeconds,
    prGroups,
    topLifts,
    attentionLifts: [],
    muscleBalance,
    bodyWeightStartKg: body?.value ?? null,
    bodyWeightEndKg: body?.value ?? null,
    bodyWeightChangeKg: null,
    streak: null,
    headline: `${session.templateName} — done.`,
    focus:
      prGroups.length > 0
        ? "New bests are in. Next time, match the top set and add one clean rep before adding load."
        : "Session logged. Next time, match the top set and chase one more clean 8 before adding load.",
    comparison: {
      previousVolumeKg: previousVolume !== null ? round(previousVolume, 2) : null,
      volumePct:
        previousVolume && previousVolume > 0
          ? round(((volumeKg - previousVolume) / previousVolume) * 100, 1)
          : null,
      previousSessionCount: previousSession ? 1 : null,
      sessionDelta: null,
    },
    session: {
      id: session.id,
      title: session.templateName,
      date: session.scheduledDate,
      durationSeconds,
      sets,
      reps,
      volumeKg: round(volumeKg, 2),
      notes: session.notes,
    },
  };
}

export function formatRecapPrMetric(
  pr: RecapPr,
  weightUnit: WeightUnit,
): string {
  switch (pr.metric) {
    case "maxWeight":
      return pr.reps === null
        ? formatWeight(pr.value, weightUnit)
        : `${formatWeight(pr.value, weightUnit)} × ${pr.reps}`;
    case "repsAtWeight":
      return `${pr.value} reps${pr.weightKg !== null ? ` @ ${formatWeight(pr.weightKg, weightUnit)}` : ""}`;
    case "exerciseVolume":
    case "sessionVolume":
      return formatVolume(pr.value, weightUnit);
    case "targetPerformance":
      return `${pr.value} reps`;
    default:
      return `${pr.value} ${pr.unit}`.trim();
  }
}

export function prDeltaText(
  pr: RecapPr,
  weightUnit: WeightUnit,
): string | null {
  if (pr.previousValue === null) return "first mark";
  if (pr.metric === "maxWeight") {
    const delta = pr.value - pr.previousValue;
    if (Math.abs(delta) < 0.01) return null;
    return formatDeltaWeight(delta, weightUnit);
  }
  if (pr.metric === "repsAtWeight" || pr.metric === "targetPerformance") {
    const delta = pr.value - pr.previousValue;
    return delta === 0 ? null : `${delta > 0 ? "+" : ""}${delta} reps`;
  }
  return null;
}

export function formatRecapText(data: RecapData): string {
  const unit = data.weightUnit;
  const lines = [
    `FORGE / ${data.periodLabel.toUpperCase()}`,
    data.periodSubLabel,
    "",
    data.headline,
    "",
  ];
  if (data.topLifts.length > 0) {
    lines.push("TOP SETS (8-REP FOCUS)");
    for (const lift of data.topLifts.slice(0, 4)) {
      lines.push(
        `- ${lift.name}: ${formatWeight(lift.bestWeightKg, unit)} × ${lift.bestReps ?? "—"}${lift.deltaKg !== null ? ` (${formatDeltaWeight(lift.deltaKg, unit)})` : ""}`,
      );
    }
    lines.push("");
  }
  if (data.prGroups.length > 0) {
    lines.push("NEW MARKS");
    for (const group of data.prGroups.slice(0, 4)) {
      lines.push(
        `- ${group.exerciseName}: ${group.metrics
          .slice(0, 2)
          .map((pr) => `${pr.label} ${formatRecapPrMetric(pr, unit)}`)
          .join(" · ")}`,
      );
    }
    lines.push("");
  }
  if (data.bodyWeightChangeKg !== null) {
    lines.push(
      `BODYWEIGHT: ${formatDeltaWeight(data.bodyWeightChangeKg, unit)} (${formatWeight(data.bodyWeightEndKg, unit)})`,
      "",
    );
  }
  lines.push("NEXT FOCUS", data.focus, "", "FORGED BY CONSISTENCY");
  return lines.join("\n");
}
