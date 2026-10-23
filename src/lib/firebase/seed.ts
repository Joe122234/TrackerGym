import { getDoc, getDocs, writeBatch } from "firebase/firestore";
import { DEFAULT_REPS, DEFAULT_REST_SECONDS, DEFAULT_SETS, SEED_VERSION, seedExerciseDefinitions, seedSchedule, seedWorkoutTemplates } from "@/domain/seed";
import type { Preferences, Profile } from "@/domain/types";
import { SINGLE_USER } from "@/config/user";
import { requireFirebaseClient } from "./client";
import {
  exerciseDefinitionRef,
  exerciseDefinitionsCollection,
  initMetaRef,
  preferencesRef,
  profileRef,
  scheduleCollection,
  scheduleRef,
  templateRef,
  templatesCollection,
} from "./paths";
import {
  preferencesSchema,
  profileSchema,
  scheduleEntrySchema,
  workoutTemplateSchema,
} from "@/domain/schemas";

export const SCHEMA_VERSION = 1;

function defaultProfile(now: number): Profile {
  return {
    displayName: SINGLE_USER.displayName,
    heightCm: SINGLE_USER.heightCm,
    weightKg: SINGLE_USER.weightKg,
    weightUnit: SINGLE_USER.weightUnit,
    measurementUnit: SINGLE_USER.measurementUnit,
    timezone: SINGLE_USER.timezone,
    theme: "dark",
    createdAt: now,
    updatedAt: now,
  };
}

function defaultPreferences(now: number): Preferences {
  return {
    // This log has no onboarding flow. First run lands directly on Home.
    onboardingComplete: true,
    defaultSets: DEFAULT_SETS,
    defaultReps: DEFAULT_REPS,
    defaultRestSeconds: DEFAULT_REST_SECONDS,
    timerSound: true,
    timerVibration: true,
    weekStartsOn: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Idempotent, atomic first-run setup. Existing documents are never overwritten;
 * only missing seed documents are created and an initialization marker is set.
 */
export async function ensureUserInitialized(
  uid: string,
): Promise<{ initialized: boolean }> {
  const { db } = requireFirebaseClient();
  const initSnap = await getDoc(initMetaRef(db, uid));
  if (initSnap.exists()) return { initialized: false };

  const [
    profileSnap,
    preferencesSnap,
    templatesSnap,
    exercisesSnap,
    scheduleSnap,
  ] = await Promise.all([
    getDoc(profileRef(db, uid)),
    getDoc(preferencesRef(db, uid)),
    getDocs(templatesCollection(db, uid)),
    getDocs(exerciseDefinitionsCollection(db, uid)),
    getDocs(scheduleCollection(db, uid)),
  ]);

  const now = Date.now();
  const batch = writeBatch(db);
  const existingTemplateIds = new Set(
    templatesSnap.docs.map((document) => document.id),
  );
  const existingExerciseIds = new Set(
    exercisesSnap.docs.map((document) => document.id),
  );
  const existingScheduleIds = new Set(
    scheduleSnap.docs.map((document) => document.id),
  );

  if (!profileSnap.exists()) {
    batch.set(profileRef(db, uid), defaultProfile(now));
  }
  if (!preferencesSnap.exists()) {
    batch.set(preferencesRef(db, uid), defaultPreferences(now));
  }

  for (const definition of seedExerciseDefinitions(now)) {
    if (!existingExerciseIds.has(definition.id)) {
      batch.set(exerciseDefinitionRef(db, uid, definition.id), definition);
    }
  }

  for (const template of seedWorkoutTemplates(now)) {
    if (!existingTemplateIds.has(template.id)) {
      batch.set(templateRef(db, uid, template.id), template);
    }
  }

  for (const entry of seedSchedule(now)) {
    if (!existingScheduleIds.has(entry.id)) {
      batch.set(scheduleRef(db, uid, entry.id), entry);
    }
  }

  batch.set(initMetaRef(db, uid), {
    status: "complete",
    schemaVersion: SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    seededAt: now,
    updatedAt: now,
  });

  await batch.commit();
  return { initialized: true };
}

/**
 * Restores the original weekly split and templates. Completed sessions are
 * intentionally untouched; all historical snapshots remain intact.
 */
export async function restoreStartingSplit(uid: string): Promise<void> {
  const { db } = requireFirebaseClient();
  const [templatesSnap, , scheduleSnap] = await Promise.all([
    getDocs(templatesCollection(db, uid)),
    getDocs(exerciseDefinitionsCollection(db, uid)),
    getDocs(scheduleCollection(db, uid)),
  ]);
  const now = Date.now();
  const batch = writeBatch(db);

  for (const document of templatesSnap.docs) {
    batch.delete(document.ref);
  }
  for (const document of scheduleSnap.docs) {
    batch.delete(document.ref);
  }

  const seededExercises = seedExerciseDefinitions(now);
  for (const definition of seededExercises) {
    batch.set(exerciseDefinitionRef(db, uid, definition.id), definition);
  }
  for (const template of seedWorkoutTemplates(now)) {
    batch.set(templateRef(db, uid, template.id), template);
  }
  for (const entry of seedSchedule(now)) {
    batch.set(scheduleRef(db, uid, entry.id), entry);
  }

  batch.set(
    initMetaRef(db, uid),
    {
      status: "complete",
      schemaVersion: SCHEMA_VERSION,
      seedVersion: SEED_VERSION,
      seededAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  await batch.commit();
}

/**
 * Returns validation errors without throwing in callers that need to show a
 * human-readable data-integrity message.
 */
export function validateProfileDocument(data: unknown): Profile | null {
  const parsed = profileSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validatePreferencesDocument(data: unknown): Preferences | null {
  const parsed = preferencesSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateTemplateDocument(data: unknown) {
  const parsed = workoutTemplateSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateScheduleDocument(data: unknown) {
  const parsed = scheduleEntrySchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export { preferencesSchema };
