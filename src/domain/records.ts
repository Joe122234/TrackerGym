import type {
  LoadBasis,
  PersonalRecord,
  PersonalRecordMetric,
  SummaryPr,
  WorkoutSession,
} from "./types";
import {
  getExerciseVolumeKg,
  getSetVolumeKg,
  getTotalVolumeKg,
} from "./workout";
import { round } from "./units";

interface RecordCandidate {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  metric: PersonalRecordMetric;
  scopeKey: string;
  value: number;
  unit: string;
  loadBasis: LoadBasis | null;
  weightKg: number | null;
  reps: number | null;
  achievedAt: number;
  sessionId: string;
  scheduledDate: string;
}

const METRIC_LABELS: Record<PersonalRecordMetric, string> = {
  maxWeight: "Heaviest set",
  repsAtWeight: "Most reps at a weight",
  estimated1RM: "Best estimated 1RM",
  exerciseVolume: "Best exercise volume",
  sessionVolume: "Best session volume",
  targetPerformance: "Best target performance",
};

function docSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function recordId(candidate: {
  exerciseId: string | null;
  metric: PersonalRecordMetric;
  scopeKey: string;
}): string {
  return `pr_${candidate.metric}_${candidate.exerciseId ?? "session"}_${docSafe(candidate.scopeKey)}`;
}

export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (weightKg <= 0 || reps < 1 || reps > 12) return null;
  return round(weightKg * (1 + reps / 30), 2);
}

function achievementTimestamp(session: WorkoutSession): number {
  return session.completedAt ?? session.updatedAt ?? session.startedAt;
}

function addCandidate(
  target: Map<string, RecordCandidate>,
  candidate: Omit<RecordCandidate, "id">,
): void {
  const id = recordId(candidate);
  const existing = target.get(id);
  if (!existing || candidate.value > existing.value) {
    target.set(id, { ...candidate, id });
  }
}

export function recordCandidatesForSession(
  session: WorkoutSession,
): RecordCandidate[] {
  if (session.status !== "completed") return [];
  const candidates = new Map<string, RecordCandidate>();
  const sessionTimestamp = achievementTimestamp(session);
  let sessionVolume = 0;

  for (const exercise of session.exercises) {
    const basis = exercise.loadBasis;
    let exerciseVolume = 0;
    let hasNumericLoad = false;

    for (const set of exercise.sets) {
      if (set.status !== "completed") continue;
      if (set.weightKg === null || set.reps === null) continue;
      if (!Number.isFinite(set.weightKg) || !Number.isFinite(set.reps)) continue;
      if (set.reps <= 0 || set.weightKg < 0) continue;
      const setVolume = getSetVolumeKg(set) ?? 0;
      exerciseVolume += setVolume;
      sessionVolume += setVolume;
      if (set.weightKg === 0) continue;
      hasNumericLoad = true;

      addCandidate(candidates, {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        metric: "maxWeight",
        scopeKey: `${basis}`,
        value: set.weightKg,
        unit: "kg",
        loadBasis: basis,
        weightKg: set.weightKg,
        reps: set.reps,
        achievedAt: set.completedAt ?? sessionTimestamp,
        sessionId: session.id,
        scheduledDate: session.scheduledDate,
      });

      addCandidate(candidates, {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        metric: "repsAtWeight",
        scopeKey: `${basis}_${round(set.weightKg, 3)}`,
        value: set.reps,
        unit: "reps",
        loadBasis: basis,
        weightKg: set.weightKg,
        reps: set.reps,
        achievedAt: set.completedAt ?? sessionTimestamp,
        sessionId: session.id,
        scheduledDate: session.scheduledDate,
      });

      const e1rm = estimatedOneRepMax(set.weightKg, set.reps);
      if (e1rm !== null) {
        addCandidate(candidates, {
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          metric: "estimated1RM",
          scopeKey: basis,
          value: e1rm,
          unit: "kg",
          loadBasis: basis,
          weightKg: set.weightKg,
          reps: set.reps,
          achievedAt: set.completedAt ?? sessionTimestamp,
          sessionId: session.id,
          scheduledDate: session.scheduledDate,
        });
      }
    }

    if (exerciseVolume > 0) {
      addCandidate(candidates, {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        metric: "exerciseVolume",
        scopeKey: basis,
        value: round(exerciseVolume, 2),
        unit: "kg·reps",
        loadBasis: basis,
        weightKg: null,
        reps: null,
        achievedAt: sessionTimestamp,
        sessionId: session.id,
        scheduledDate: session.scheduledDate,
      });
    }

    const targetSets = exercise.sets.slice(0, exercise.targetSets);
    const targetAchieved =
      targetSets.length >= exercise.targetSets &&
      targetSets.every(
        (set) =>
          set.status === "completed" &&
          set.reps !== null &&
          set.reps >= exercise.targetReps,
      );
    if (targetAchieved && hasNumericLoad) {
      addCandidate(candidates, {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        metric: "targetPerformance",
        scopeKey: `${basis}_${exercise.targetSets}x${exercise.targetReps}`,
        value: targetSets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
        unit: "reps",
        loadBasis: basis,
        weightKg: null,
        reps: exercise.targetSets,
        achievedAt: sessionTimestamp,
        sessionId: session.id,
        scheduledDate: session.scheduledDate,
      });
    }
  }

  if (sessionVolume > 0) {
    addCandidate(candidates, {
      exerciseId: null,
      exerciseName: "Full session",
      metric: "sessionVolume",
      scopeKey: "all",
      value: round(sessionVolume, 2),
      unit: "kg·reps",
      loadBasis: null,
      weightKg: null,
      reps: null,
      achievedAt: sessionTimestamp,
      sessionId: session.id,
      scheduledDate: session.scheduledDate,
    });
  }

  return [...candidates.values()];
}

export function buildPersonalRecords(
  sessions: WorkoutSession[],
): PersonalRecord[] {
  const completed = sessions.filter((session) => session.status === "completed");
  const groups = new Map<string, RecordCandidate[]>();

  for (const session of completed) {
    for (const candidate of recordCandidatesForSession(session)) {
      const existing = groups.get(candidate.id) ?? [];
      existing.push(candidate);
      groups.set(candidate.id, existing);
    }
  }

  const records: PersonalRecord[] = [];
  for (const candidates of groups.values()) {
    const sorted = [...candidates].sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.achievedAt - b.achievedAt;
    });
    const best = sorted[0];
    const previous = sorted.find((candidate) => candidate.value < best.value);
    records.push({
      id: best.id,
      exerciseId: best.exerciseId,
      exerciseName: best.exerciseName,
      metric: best.metric,
      scopeKey: best.scopeKey,
      value: best.value,
      unit: best.unit,
      loadBasis: best.loadBasis,
      weightKg: best.weightKg,
      reps: best.reps,
      achievedAt: best.achievedAt,
      sessionId: best.sessionId,
      scheduledDate: best.scheduledDate,
      previousValue: previous?.value ?? null,
    });
  }

  return records.sort((a, b) => b.achievedAt - a.achievedAt);
}

export function findNewPrsForSession(
  session: WorkoutSession,
  sessions: WorkoutSession[],
): SummaryPr[] {
  const currentCandidates = recordCandidatesForSession(session);
  if (currentCandidates.length === 0) return [];
  const previousRecords = new Map(
    buildPersonalRecords(
      sessions.filter((candidate) => candidate.id !== session.id),
    ).map((record) => [record.id, record]),
  );

  const newPrs: SummaryPr[] = [];
  for (const candidate of currentCandidates) {
    const previous = previousRecords.get(candidate.id);
    if (previous && candidate.value <= previous.value) continue;
    newPrs.push({
      metric: candidate.metric,
      label: METRIC_LABELS[candidate.metric],
      value: candidate.value,
      unit: candidate.unit,
      previousValue: previous?.value ?? null,
      exerciseId: candidate.exerciseId,
      exerciseName:
        candidate.metric === "sessionVolume" ? null : candidate.exerciseName,
      scopeKey: candidate.scopeKey,
    });
  }

  const priority: Record<PersonalRecordMetric, number> = {
    maxWeight: 0,
    estimated1RM: 1,
    sessionVolume: 2,
    targetPerformance: 3,
    exerciseVolume: 4,
    repsAtWeight: 5,
  };

  return newPrs.sort((a, b) => {
    const priorityDiff = priority[a.metric] - priority[b.metric];
    if (priorityDiff !== 0) return priorityDiff;
    return (b.exerciseName ?? "").localeCompare(a.exerciseName ?? "");
  });
}

export function personalRecordsForExercise(
  records: PersonalRecord[],
  exerciseId: string,
): PersonalRecord[] {
  return records
    .filter(
      (record) =>
        record.exerciseId === exerciseId &&
        ["maxWeight", "estimated1RM", "repsAtWeight"].includes(record.metric),
    )
    .sort((a, b) => a.metric.localeCompare(b.metric));
}

export function prMetricLabel(metric: PersonalRecordMetric): string {
  return METRIC_LABELS[metric];
}

export function recentUniquePrs(
  records: PersonalRecord[],
  limit = 4,
): PersonalRecord[] {
  const priority: Record<PersonalRecord["metric"], number> = {
    maxWeight: 0,
    repsAtWeight: 1,
    targetPerformance: 2,
    exerciseVolume: 3,
    sessionVolume: 4,
    estimated1RM: 99,
  };
  const seen = new Set<string>();
  const result: PersonalRecord[] = [];
  for (const record of [...records].sort(
    (a, b) =>
      priority[a.metric] - priority[b.metric] ||
      b.achievedAt - a.achievedAt,
  )) {
    // FORGE is built around 8-rep work. Keep the stored estimate for
    // compatibility, but do not surface it as a headline achievement.
    if (record.metric === "estimated1RM") continue;
    const key = `${record.exerciseId}_${record.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(record);
    if (result.length >= limit) break;
  }
  return result;
}

export function totalNumericVolumeForSessions(
  sessions: WorkoutSession[],
): number {
  return round(
    sessions.reduce((total, session) => total + getTotalVolumeKg(session), 0),
    2,
  );
}

export function exerciseHistorySessions(
  sessions: WorkoutSession[],
  exerciseId: string,
): WorkoutSession[] {
  return sessions
    .filter(
      (session) =>
        session.status === "completed" &&
        session.exercises.some(
          (exercise) => exercise.exerciseId === exerciseId,
        ),
    )
    .sort((a, b) => (a.completedAt ?? a.startedAt) - (b.completedAt ?? b.startedAt));
}

export function bestSessionSetForExercise(
  session: WorkoutSession,
  exerciseId: string,
): { weightKg: number; reps: number; e1rm: number | null; date: string } | null {
  const exercise = session.exercises.find(
    (entry) => entry.exerciseId === exerciseId,
  );
  if (!exercise) return null;
  const sets = exercise.sets.filter(
    (set) =>
      set.status === "completed" &&
      set.weightKg !== null &&
      set.reps !== null &&
      set.reps > 0,
  );
  if (sets.length === 0) return null;
  let best: { weightKg: number; reps: number; e1rm: number | null } | null = null;
  for (const set of sets) {
    if (set.weightKg === null || set.reps === null) continue;
    const e1rm = estimatedOneRepMax(set.weightKg, set.reps);
    const candidate = { weightKg: set.weightKg, reps: set.reps, e1rm };
    if (
      !best ||
      (candidate.e1rm ?? candidate.weightKg) >
        (best.e1rm ?? best.weightKg)
    ) {
      best = candidate;
    }
  }
  return best ? { ...best, date: session.scheduledDate } : null;
}

export { getExerciseVolumeKg };
