import type {
  LoadPrescription,
  SessionSet,
  WeightUnit,
  WorkoutSession,
} from "./types";
import { formatWeight, round } from "./units";

export type RecommendationKind =
  | "increase"
  | "maintain"
  | "achieved"
  | "insufficient"
  | "inconsistent"
  | "manual";

export interface ProgressionRecommendation {
  kind: RecommendationKind;
  title: string;
  detail: string;
  suggestedWeightKg: number | null;
  incrementKg: number | null;
  latestWeightKg: number | null;
  latestSessionId: string | null;
  targetAchieved: boolean;
  sessionsConsidered: number;
}

interface ExerciseSnapshot {
  session: WorkoutSession;
  sets: SessionSet[];
  targetSets: number;
  targetReps: number;
  load: LoadPrescription;
  loadBasis: string;
}

function getExerciseSnapshot(
  session: WorkoutSession,
  exerciseId: string,
): ExerciseSnapshot | null {
  const exercise = session.exercises.find(
    (candidate) => candidate.exerciseId === exerciseId,
  );
  if (!exercise) return null;
  return {
    session,
    sets: exercise.sets,
    targetSets: exercise.targetSets,
    targetReps: exercise.targetReps,
    load: exercise.load,
    loadBasis: exercise.loadBasis,
  };
}

function modeWeight(sets: SessionSet[]): number | null {
  const weights = sets
    .filter((set) => set.status === "completed" && set.weightKg !== null)
    .map((set) => round(set.weightKg as number, 3));
  if (weights.length === 0) return null;
  const counts = new Map<number, number>();
  for (const weight of weights) {
    counts.set(weight, (counts.get(weight) ?? 0) + 1);
  }
  let best = weights[0];
  let bestCount = 0;
  for (const [weight, count] of counts.entries()) {
    if (count > bestCount) {
      best = weight;
      bestCount = count;
    }
  }
  return best;
}

function targetAchieved(
  sets: SessionSet[],
  targetSets: number,
  targetReps: number,
): boolean {
  if (sets.length < targetSets) return false;
  const plannedSets = sets.slice(0, targetSets);
  return plannedSets.every(
    (set) =>
      set.status === "completed" &&
      set.reps !== null &&
      set.reps >= targetReps &&
      set.weightKg !== null,
  );
}

export function getProgressionRecommendation(input: {
  exerciseId: string;
  exerciseName: string;
  sessions: WorkoutSession[];
  defaultLoad: LoadPrescription;
  targetSets: number;
  targetReps: number;
  incrementKg: number | null;
  unit: WeightUnit;
}): ProgressionRecommendation {
  const {
    exerciseId,
    sessions,
    defaultLoad,
    targetSets,
    targetReps,
    incrementKg,
    unit,
  } = input;

  const history = sessions
    .filter(
      (session) =>
        session.status === "completed" &&
        session.exercises.some(
          (exercise) => exercise.exerciseId === exerciseId,
        ),
    )
    .sort(
      (a, b) =>
        (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt),
    );

  if (history.length === 0) {
    return {
      kind: "insufficient",
      title: "Build your baseline",
      detail:
        defaultLoad === null
          ? "Set a working weight when you are ready and log your first sets."
          : "Log a session to start getting recommendations from your real performance.",
      suggestedWeightKg: null,
      incrementKg,
      latestWeightKg: null,
      latestSessionId: null,
      targetAchieved: false,
      sessionsConsidered: 0,
    };
  }

  const snapshots = history
    .map((session) => getExerciseSnapshot(session, exerciseId))
    .filter((snapshot): snapshot is ExerciseSnapshot => snapshot !== null)
    .slice(0, 3);

  const latest = snapshots[0];
  const latestWorkingWeight = modeWeight(latest.sets);
  const isDescriptive =
    latest.load?.kind === "descriptive" ||
    defaultLoad?.kind === "descriptive";
  const hasNumericSets = latest.sets.some(
    (set) =>
      set.status === "completed" &&
      set.weightKg !== null &&
      set.reps !== null,
  );

  if (isDescriptive || !hasNumericSets) {
    return {
      kind: "manual",
      title: "Review this load manually",
      detail: isDescriptive
        ? "This exercise uses a descriptive load, so FORGE will not invent a numeric increase. Use the recorded reps to decide your next configuration."
        : "This exercise has no numeric load recorded, so volume and load progression cannot be calculated.",
      suggestedWeightKg: null,
      incrementKg: null,
      latestWeightKg: null,
      latestSessionId: latest.session.id,
      targetAchieved: false,
      sessionsConsidered: snapshots.length,
    };
  }

  const achieved = targetAchieved(latest.sets, targetSets, targetReps);
  const latestExercise = latest.sets
    .filter((set) => set.status === "completed")
    .map((set) => set.reps)
    .filter((reps): reps is number => reps !== null);

  if (achieved) {
    if (incrementKg === null || incrementKg <= 0) {
      return {
        kind: "achieved",
        title: "Target achieved",
        detail: `You completed ${targetSets} × ${targetReps} at ${formatWeight(
          latestWorkingWeight,
          unit,
        )}. Set a progression increment in the workout editor to get a weight suggestion.`,
        suggestedWeightKg: null,
        incrementKg: null,
        latestWeightKg: latestWorkingWeight,
        latestSessionId: latest.session.id,
        targetAchieved: true,
        sessionsConsidered: snapshots.length,
      };
    }
    const suggested = round((latestWorkingWeight ?? 0) + incrementKg, 2);
    return {
      kind: "increase",
      title: "Consider increasing",
      detail: `You hit all ${targetSets} × ${targetReps} at ${formatWeight(
        latestWorkingWeight,
        unit,
      )}. Try ${formatWeight(suggested, unit)} next time, or keep the same load if your form needs more work.`,
      suggestedWeightKg: suggested,
      incrementKg,
      latestWeightKg: latestWorkingWeight,
      latestSessionId: latest.session.id,
      targetAchieved: true,
      sessionsConsidered: snapshots.length,
    };
  }

  const recentWeights = snapshots
    .map((snapshot) => modeWeight(snapshot.sets))
    .filter((weight): weight is number => weight !== null);
  const spread =
    recentWeights.length >= 2
      ? Math.max(...recentWeights) - Math.min(...recentWeights)
      : 0;
  const inconsistent =
    snapshots.length >= 2 &&
    incrementKg !== null &&
    spread > Math.max(incrementKg * 2, 5);

  if (inconsistent) {
    return {
      kind: "inconsistent",
      title: "Review your recent sessions",
      detail:
        "Your recent loads have varied noticeably. FORGE will keep your prescription unchanged; choose the load that best matches the work you want to do.",
      suggestedWeightKg: null,
      incrementKg,
      latestWeightKg: latestWorkingWeight,
      latestSessionId: latest.session.id,
      targetAchieved: false,
      sessionsConsidered: snapshots.length,
    };
  }

  return {
    kind: "maintain",
    title: "Hold the load and build reps",
    detail: `You recorded ${latestExercise.join(", ")} reps at ${formatWeight(
      latestWorkingWeight,
      unit,
    )}. Keep this load and work toward ${targetSets} × ${targetReps} before increasing.`,
    suggestedWeightKg: latestWorkingWeight,
    incrementKg,
    latestWeightKg: latestWorkingWeight,
    latestSessionId: latest.session.id,
    targetAchieved: false,
    sessionsConsidered: snapshots.length,
  };
}
