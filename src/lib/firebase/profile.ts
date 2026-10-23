import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type {
  ExerciseDefinition,
  Preferences,
  Profile,
  ScheduleEntry,
  TemplateExercise,
  Weekday,
  WorkoutTemplate,
} from "@/domain/types";
import { SEED_VERSION, seedExerciseDefinitions, seedSchedule, seedWorkoutTemplates, DEFAULT_REPS, DEFAULT_REST_SECONDS, DEFAULT_SETS } from "@/domain/seed";
import { makeId } from "@/domain/workout";
import { validateProfileDocument } from "./seed";
import { requireFirebaseClient } from "./client";
import {
  exerciseDefinitionRef,
  preferencesRef,
  profileRef,
  scheduleCollection,
  scheduleRef,
  templateRef,
  templatesCollection,
} from "./paths";
import {
  exerciseDefinitionSchema,
  preferencesSchema,
  workoutTemplateSchema,
} from "@/domain/schemas";

export async function updateProfile(
  uid: string,
  values: Pick<
    Profile,
    | "displayName"
    | "heightCm"
    | "weightKg"
    | "weightUnit"
    | "measurementUnit"
    | "timezone"
  >,
): Promise<void> {
  const { db } = requireFirebaseClient();
  const current = await getDoc(profileRef(db, uid));
  const now = Date.now();
  const next: Profile = {
    displayName: values.displayName,
    heightCm: values.heightCm,
    weightKg: values.weightKg,
    weightUnit: values.weightUnit,
    measurementUnit: values.measurementUnit,
    timezone: values.timezone,
    theme: "dark",
    createdAt: current.exists()
      ? validateProfileDocument(current.data())?.createdAt ?? now
      : now,
    updatedAt: now,
  };
  const parsed = validateProfileDocument(next);
  if (!parsed) throw new Error("The profile values are not valid.");
  await setDoc(profileRef(db, uid), parsed);
}

export async function updatePreferences(
  uid: string,
  current: Preferences,
  values: Pick<
    Preferences,
    | "onboardingComplete"
    | "defaultSets"
    | "defaultReps"
    | "defaultRestSeconds"
    | "timerSound"
    | "timerVibration"
  >,
): Promise<void> {
  const { db } = requireFirebaseClient();
  const now = Date.now();
  const next: Preferences = {
    ...current,
    ...values,
    weekStartsOn: 1,
    updatedAt: now,
  };
  const parsed = preferencesSchema.safeParse(next);
  if (!parsed.success) throw new Error("The preference values are not valid.");
  await setDoc(preferencesRef(db, uid), parsed.data);
}

export async function completeOnboarding(uid: string, current: Preferences) {
  await updatePreferences(uid, current, {
    onboardingComplete: true,
    defaultSets: current.defaultSets,
    defaultReps: current.defaultReps,
    defaultRestSeconds: current.defaultRestSeconds,
    timerSound: current.timerSound,
    timerVibration: current.timerVibration,
  });
}

export async function createExerciseDefinition(
  uid: string,
  values: Omit<ExerciseDefinition, "id" | "createdAt" | "updatedAt" | "isArchived" | "seeded">,
): Promise<ExerciseDefinition> {
  const { db } = requireFirebaseClient();
  const now = Date.now();
  const definition: ExerciseDefinition = {
    id: makeId("ex"),
    name: values.name.trim(),
    category: values.category,
    equipment: values.equipment.trim(),
    defaultProgressionIncrementKg: values.defaultProgressionIncrementKg,
    isArchived: false,
    seeded: false,
    createdAt: now,
    updatedAt: now,
  };
  const parsed = exerciseDefinitionSchema.safeParse(definition);
  if (!parsed.success) throw new Error("Exercise details are not valid.");
  await setDoc(exerciseDefinitionRef(db, uid, definition.id), parsed.data);
  return parsed.data;
}

export async function updateExerciseDefinition(
  uid: string,
  current: ExerciseDefinition,
  values: Pick<
    ExerciseDefinition,
    "name" | "category" | "equipment" | "defaultProgressionIncrementKg"
  >,
): Promise<ExerciseDefinition> {
  const { db } = requireFirebaseClient();
  const next: ExerciseDefinition = {
    ...current,
    name: values.name.trim(),
    category: values.category,
    equipment: values.equipment.trim(),
    defaultProgressionIncrementKg: values.defaultProgressionIncrementKg,
    updatedAt: Date.now(),
  };
  const parsed = exerciseDefinitionSchema.safeParse(next);
  if (!parsed.success) throw new Error("Exercise details are not valid.");
  await setDoc(exerciseDefinitionRef(db, uid, current.id), parsed.data);
  return parsed.data;
}

export async function createWorkoutTemplate(
  uid: string,
  values: {
    name: string;
    type: WorkoutTemplate["type"];
    exercises?: TemplateExercise[];
    day?: Weekday | "none";
  },
  definitions: ExerciseDefinition[],
): Promise<WorkoutTemplate> {
  const { db } = requireFirebaseClient();
  const now = Date.now();
  const template: WorkoutTemplate = {
    id: makeId("tpl"),
    name: values.name.trim(),
    type: values.type,
    exercises: values.exercises ?? [],
    enabled: true,
    version: 1,
    seededKey: null,
    createdAt: now,
    updatedAt: now,
  };
  const parsed = workoutTemplateSchema.safeParse(template);
  if (!parsed.success) throw new Error("Workout template is not valid.");
  const batch = writeBatch(db);
  batch.set(templateRef(db, uid, template.id), parsed.data);
  if (values.day && values.day !== "none") {
    const entry: ScheduleEntry = {
      id: values.day,
      day: values.day,
      kind: "training",
      templateId: template.id,
      templateName: template.name,
      updatedAt: now,
    };
    batch.set(scheduleRef(db, uid, values.day), entry);
  }
  await batch.commit();
  void definitions;
  return parsed.data;
}

export async function saveWorkoutTemplate(
  uid: string,
  template: WorkoutTemplate,
  schedule: ScheduleEntry[],
  day: Weekday | "none",
): Promise<WorkoutTemplate> {
  const { db } = requireFirebaseClient();
  const now = Date.now();
  const cleanedExercises = template.exercises.map((exercise, index) => ({
    ...exercise,
    order: index,
  }));
  const next: WorkoutTemplate = {
    ...template,
    name: template.name.trim(),
    exercises: cleanedExercises,
    version: template.version + 1,
    updatedAt: now,
  };
  const parsed = workoutTemplateSchema.safeParse(next);
  if (!parsed.success) throw new Error("Workout template is not valid.");

  const batch = writeBatch(db);
  batch.set(templateRef(db, uid, template.id), parsed.data);

  for (const entry of schedule) {
    if (
      entry.templateId === template.id &&
      (!day || day === "none" || entry.day !== day)
    ) {
      batch.set(scheduleRef(db, uid, entry.day), {
        ...entry,
        kind: "rest",
        templateId: null,
        templateName: null,
        updatedAt: now,
      });
    }
  }

  if (day !== "none") {
    batch.set(scheduleRef(db, uid, day), {
      id: day,
      day,
      kind: "training",
      templateId: template.id,
      templateName: next.name,
      updatedAt: now,
    });
  }

  await batch.commit();
  return parsed.data;
}

export async function deleteWorkoutTemplate(
  uid: string,
  templateId: string,
  schedule: ScheduleEntry[],
): Promise<void> {
  const { db } = requireFirebaseClient();
  const now = Date.now();
  const batch = writeBatch(db);
  batch.delete(templateRef(db, uid, templateId));
  for (const entry of schedule) {
    if (entry.templateId === templateId) {
      batch.set(scheduleRef(db, uid, entry.day), {
        ...entry,
        kind: "rest",
        templateId: null,
        templateName: null,
        updatedAt: now,
      });
    }
  }
  await batch.commit();
}

export async function duplicateWorkoutTemplate(
  uid: string,
  source: WorkoutTemplate,
): Promise<WorkoutTemplate> {
  const { db } = requireFirebaseClient();
  const now = Date.now();
  const copy: WorkoutTemplate = {
    ...source,
    id: makeId("tpl"),
    name: `${source.name} Copy`.slice(0, 80),
    seededKey: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    exercises: source.exercises.map((exercise) => ({
      ...exercise,
      id: makeId("te"),
      defaultLoad: exercise.defaultLoad ? { ...exercise.defaultLoad } : null,
    })),
  };
  const parsed = workoutTemplateSchema.safeParse(copy);
  if (!parsed.success) throw new Error("Could not duplicate this workout.");
  await setDoc(templateRef(db, uid, copy.id), parsed.data);
  return parsed.data;
}

export async function setScheduleDay(
  uid: string,
  day: Weekday,
  template: WorkoutTemplate | null,
  schedule: ScheduleEntry[],
): Promise<void> {
  const { db } = requireFirebaseClient();
  const now = Date.now();
  const batch = writeBatch(db);

  if (!template) {
    batch.set(scheduleRef(db, uid, day), {
      id: day,
      day,
      kind: "rest",
      templateId: null,
      templateName: null,
      updatedAt: now,
    });
  } else {
    for (const entry of schedule) {
      if (entry.templateId === template.id && entry.day !== day) {
        batch.set(scheduleRef(db, uid, entry.day), {
          ...entry,
          kind: "rest",
          templateId: null,
          templateName: null,
          updatedAt: now,
        });
      }
    }
    batch.set(scheduleRef(db, uid, day), {
      id: day,
      day,
      kind: "training",
      templateId: template.id,
      templateName: template.name,
      updatedAt: now,
    });
  }

  await batch.commit();
}

/** Used only when the user explicitly restores the starting split. */
export async function restoreSplitPreservingHistory(uid: string): Promise<void> {
  const { db } = requireFirebaseClient();
  const [templatesSnap, scheduleSnap] = await Promise.all([
    getDocs(templatesCollection(db, uid)),
    getDocs(scheduleCollection(db, uid)),
  ]);
  const now = Date.now();
  const batch = writeBatch(db);
  for (const document of templatesSnap.docs) batch.delete(document.ref);
  for (const document of scheduleSnap.docs) batch.delete(document.ref);
  for (const definition of seedExerciseDefinitions(now)) {
    batch.set(exerciseDefinitionRef(db, uid, definition.id), definition);
  }
  for (const template of seedWorkoutTemplates(now)) {
    batch.set(templateRef(db, uid, template.id), template);
  }
  for (const entry of seedSchedule(now)) {
    batch.set(scheduleRef(db, uid, entry.id), entry);
  }
  batch.set(
    doc(db, "users", uid, "meta", "initialization"),
    {
      status: "complete",
      schemaVersion: 1,
      seedVersion: SEED_VERSION,
      seededAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
  await batch.commit();
}

export function newExerciseDefaults(preferences?: Preferences | null) {
  return {
    targetSets: preferences?.defaultSets ?? DEFAULT_SETS,
    targetReps: preferences?.defaultReps ?? DEFAULT_REPS,
    restSeconds: preferences?.defaultRestSeconds ?? DEFAULT_REST_SECONDS,
  };
}

export { deleteField, updateDoc, deleteDoc };
