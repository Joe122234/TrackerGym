import type {
  LoadPrescription,
  SessionExercise,
  SessionSet,
  SessionSource,
  SessionStatus,
  SetStatus,
  WorkoutSession,
} from "@/domain/types";
import { weekdayForDateKey } from "@/domain/dates";

let setCounter = 0;
let exerciseCounter = 0;
let sessionCounter = 0;

export function makeSet(
  values: {
    weightKg?: number | null;
    reps?: number | null;
    status?: SetStatus;
    loadDescription?: string | null;
    order?: number;
  } = {},
): SessionSet {
  setCounter += 1;
  return {
    id: `set_test_${setCounter}`,
    order: values.order ?? 0,
    weightKg: values.weightKg === undefined ? 100 : values.weightKg,
    loadDescription: values.loadDescription ?? null,
    loadBasis: "total",
    reps: values.reps === undefined ? 8 : values.reps,
    status: values.status ?? "completed",
    rpe: null,
    note: "",
    completedAt: 1_767_600_000_000,
  };
}

export function makeExercise(
  values: {
    exerciseId?: string;
    name?: string;
    targetSets?: number;
    targetReps?: number;
    load?: LoadPrescription;
    sets?: SessionSet[];
    note?: string;
    progressionIncrementKg?: number | null;
  } = {},
): SessionExercise {
  exerciseCounter += 1;
  const load: LoadPrescription =
    values.load === undefined
      ? { kind: "numeric", kg: 100, basis: "total" }
      : values.load;
  return {
    id: `te_test_${exerciseCounter}`,
    exerciseId: values.exerciseId ?? `ex_test_${exerciseCounter}`,
    name: values.name ?? "Test Press",
    order: exerciseCounter,
    targetSets: values.targetSets ?? 3,
    targetReps: values.targetReps ?? 8,
    load,
    loadBasis: load?.kind === "numeric" ? load.basis : "unknown",
    progressionIncrementKg:
      values.progressionIncrementKg === undefined
        ? 2.5
        : values.progressionIncrementKg,
    restSeconds: 90,
    note: values.note ?? "",
    enabled: true,
    sets: values.sets ?? [makeSet({ order: 0 })],
  };
}

export function makeSession(
  values: {
    id?: string;
    scheduledDate?: string;
    source?: SessionSource;
    status?: SessionStatus;
    exercises?: SessionExercise[];
    startedAt?: number;
    completedAt?: number | null;
    templateId?: string;
    templateName?: string;
    workoutType?: "strength" | "cardio";
    summary?: WorkoutSession["summary"];
  } = {},
): WorkoutSession {
  sessionCounter += 1;
  const scheduledDate = values.scheduledDate ?? "2026-01-05";
  const startedAt = values.startedAt ?? 1_767_600_000_000 + sessionCounter * 86_400_000;
  const status = values.status ?? "completed";
  return {
    id: values.id ?? `session_test_${sessionCounter}`,
    templateId: values.templateId ?? "tpl_test",
    templateName: values.templateName ?? "Push",
    templateVersion: 1,
    workoutType: values.workoutType ?? "strength",
    scheduledDate,
    scheduledDay: weekdayForDateKey(scheduledDate),
    source: values.source ?? "scheduled",
    status,
    startedAt,
    completedAt:
      values.completedAt === undefined
        ? status === "completed"
          ? startedAt + 3_600_000
          : null
        : values.completedAt,
    timezone: "Asia/Bangkok",
    exercises: values.exercises ?? [makeExercise()],
    cardio: null,
    notes: "",
    summary: values.summary ?? null,
    revision: 1,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}
