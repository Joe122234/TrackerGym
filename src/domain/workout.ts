import type {
  CardioRecord,
  ExerciseDefinition,
  LoadBasis,
  LoadPrescription,
  SessionExercise,
  SessionSet,
  SessionSource,
  SummaryPr,
  Weekday,
  WorkoutSession,
  WorkoutSummary,
  WorkoutTemplate,
} from "./types";
import { dateKeyInTimeZone, weekdayForDateKey } from "./dates";
import { round } from "./units";

export interface CreateSessionInput {
  template: WorkoutTemplate;
  definitions: ExerciseDefinition[];
  source: SessionSource;
  timezone: string;
  now: number;
  id?: string;
  scheduledDate?: string;
}

export function makeId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function blankCardio(): CardioRecord {
  return {
    activityType: "",
    durationSeconds: null,
    distanceKm: null,
    avgPaceSecondsPerKm: null,
    inclinePercent: null,
    speedKph: null,
    equipment: "",
    notes: "",
    intensity: null,
  };
}

export function basisForLoad(load: LoadPrescription): LoadBasis {
  return load?.kind === "numeric" ? load.basis : "unknown";
}

export function initialSetForExercise(
  exercise: Pick<
    SessionExercise,
    "load" | "loadBasis" | "sets"
  >,
  order: number,
  id = makeId("set"),
): SessionSet {
  return {
    id,
    order,
    weightKg: exercise.load?.kind === "numeric" ? exercise.load.kg : null,
    loadDescription:
      exercise.load?.kind === "descriptive" ? exercise.load.label : null,
    loadBasis: exercise.loadBasis,
    reps: null,
    status: "pending",
    rpe: null,
    note: "",
    completedAt: null,
  };
}

export function createWorkoutSession({
  template,
  definitions,
  source,
  timezone,
  now,
  id = makeId("session"),
  scheduledDate = dateKeyInTimeZone(now, timezone),
}: CreateSessionInput): WorkoutSession {
  const exerciseMap = new Map(definitions.map((entry) => [entry.id, entry]));
  const scheduledDay = weekdayForDateKey(scheduledDate);

  const exercises: SessionExercise[] = [...template.exercises]
    .filter((entry) => entry.enabled)
    .sort((a, b) => a.order - b.order)
    .map((entry, exerciseIndex) => {
      const definition = exerciseMap.get(entry.exerciseId);
      const loadBasis = basisForLoad(entry.defaultLoad);
      const base: SessionExercise = {
        id: entry.id,
        exerciseId: entry.exerciseId,
        name: definition?.name ?? "Unknown exercise",
        order: exerciseIndex,
        targetSets: entry.targetSets,
        targetReps: entry.targetReps,
        load: entry.defaultLoad ? { ...entry.defaultLoad } : null,
        loadBasis,
        progressionIncrementKg: entry.progressionIncrementKg,
        restSeconds: entry.restSeconds,
        note: entry.note,
        enabled: entry.enabled,
        sets: [],
      };
      base.sets = Array.from(
        { length: Math.max(1, entry.targetSets) },
        (_, setIndex) =>
          initialSetForExercise(base, setIndex, makeId("set")),
      );
      return base;
    });

  return {
    id,
    templateId: template.id,
    templateName: template.name,
    templateVersion: template.version,
    workoutType: template.type,
    scheduledDate,
    scheduledDay,
    source,
    status: "active",
    startedAt: now,
    completedAt: null,
    timezone,
    exercises,
    cardio: template.type === "cardio" ? blankCardio() : null,
    notes: "",
    summary: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSetVolumeKg(set: SessionSet): number | null {
  if (set.status !== "completed") return null;
  if (set.weightKg === null || set.reps === null) return null;
  if (!Number.isFinite(set.weightKg) || !Number.isFinite(set.reps)) return null;
  if (set.weightKg < 0 || set.reps < 0) return null;
  return round(set.weightKg * set.reps, 4);
}

export function getExerciseVolumeKg(exercise: SessionExercise): number {
  return exercise.sets.reduce(
    (total, set) => total + (getSetVolumeKg(set) ?? 0),
    0,
  );
}

export function getTotalVolumeKg(session: Pick<WorkoutSession, "exercises">): number {
  return round(
    session.exercises.reduce(
      (total, exercise) => total + getExerciseVolumeKg(exercise),
      0,
    ),
    4,
  );
}

export function getTotalCompletedReps(
  session: Pick<WorkoutSession, "exercises">,
): number {
  return session.exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets.reduce(
        (setTotal, set) =>
          set.status === "completed" && set.reps !== null && set.reps >= 0
            ? setTotal + set.reps
            : setTotal,
        0,
      ),
    0,
  );
}

export function getSessionSetCounts(
  session: Pick<WorkoutSession, "exercises">,
): { completed: number; skipped: number; pending: number; total: number } {
  return session.exercises.reduce(
    (counts, exercise) => {
      for (const set of exercise.sets) {
        counts.total += 1;
        if (set.status === "completed") counts.completed += 1;
        else if (set.status === "skipped") counts.skipped += 1;
        else counts.pending += 1;
      }
      return counts;
    },
    { completed: 0, skipped: 0, pending: 0, total: 0 },
  );
}

export function getSummaryDurationSeconds(
  session: Pick<WorkoutSession, "startedAt" | "completedAt">,
  now = Date.now(),
): number {
  return Math.max(
    0,
    Math.floor(((session.completedAt ?? now) - session.startedAt) / 1000),
  );
}

export function summarizeSession(
  session: WorkoutSession,
  prs: SummaryPr[] = [],
  now = Date.now(),
): WorkoutSummary {
  const setCounts = getSessionSetCounts(session);
  let volumeIncludedSets = 0;
  let volumeExcludedSets = 0;

  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.status !== "completed") continue;
      if (
        set.weightKg !== null &&
        set.reps !== null &&
        set.weightKg >= 0 &&
        set.reps >= 0
      ) {
        volumeIncludedSets += 1;
      } else {
        volumeExcludedSets += 1;
      }
    }
  }

  const exercisesCompleted = session.exercises.filter((exercise) =>
    exercise.sets.some(
      (set) => set.status === "completed" && (set.reps ?? 0) >= 0,
    ),
  ).length;

  return {
    durationSeconds: getSummaryDurationSeconds(session, now),
    exercisesPlanned: session.exercises.length,
    exercisesCompleted,
    setsCompleted: setCounts.completed,
    setsSkipped: setCounts.skipped,
    totalReps: getTotalCompletedReps(session),
    totalVolumeKg: getTotalVolumeKg(session),
    volumeIncludedSets,
    volumeExcludedSets,
    prs,
    isCardio: session.workoutType === "cardio",
  };
}

export function createSetForExercise(
  exercise: SessionExercise,
  order = exercise.sets.length,
): SessionSet {
  const base = initialSetForExercise(exercise, order);
  // A new set starts with the most recent recorded weight in this exercise
  // when available; otherwise it uses the prescription.
  const latestWithWeight = [...exercise.sets]
    .reverse()
    .find((set) => set.weightKg !== null);
  if (latestWithWeight) {
    base.weightKg = latestWithWeight.weightKg;
    base.loadDescription = latestWithWeight.loadDescription;
  }
  return base;
}

export function normalizeSessionAfterSetChanges(
  session: WorkoutSession,
  updatedExercises: SessionExercise[],
): WorkoutSession {
  return {
    ...session,
    exercises: updatedExercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      order: exerciseIndex,
      sets: exercise.sets.map((set, setIndex) => ({
        ...set,
        order: setIndex,
      })),
    })),
    revision: session.revision + 1,
    updatedAt: Date.now(),
  };
}

export interface LastExercisePerformance {
  sessionId: string;
  scheduledDate: string;
  completedAt: number;
  sets: SessionSet[];
  targetSets: number;
  targetReps: number;
}

export function findLastExercisePerformance(
  sessions: WorkoutSession[],
  exerciseId: string,
  excludeSessionId?: string,
): LastExercisePerformance | null {
  const withExercise = sessions
    .filter(
      (session) =>
        session.status === "completed" &&
        session.id !== excludeSessionId &&
        session.exercises.some((exercise) => exercise.exerciseId === exerciseId),
    )
    .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));

  const latest = withExercise[0];
  if (!latest) return null;
  const exercise = latest.exercises.find(
    (candidate) => candidate.exerciseId === exerciseId,
  );
  if (!exercise) return null;

  return {
    sessionId: latest.id,
    scheduledDate: latest.scheduledDate,
    completedAt: latest.completedAt ?? latest.startedAt,
    sets: exercise.sets.filter((set) => set.status === "completed"),
    targetSets: exercise.targetSets,
    targetReps: exercise.targetReps,
  };
}

export function findBestSetForExercise(
  session: WorkoutSession,
  exerciseId: string,
): SessionSet | null {
  const exercise = session.exercises.find(
    (candidate) => candidate.exerciseId === exerciseId,
  );
  if (!exercise) return null;
  const completed = exercise.sets.filter(
    (set) => set.status === "completed" && set.weightKg !== null,
  );
  if (completed.length === 0) return null;
  return completed.reduce((best, set) => {
    const bestScore = (best.weightKg ?? 0) * 1000 + (best.reps ?? 0);
    const setScore = (set.weightKg ?? 0) * 1000 + (set.reps ?? 0);
    return setScore > bestScore ? set : best;
  }, completed[0]);
}

export function getScheduledWeekday(date: string): Weekday {
  return weekdayForDateKey(date);
}

export function calculateElapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}
