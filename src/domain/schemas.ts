import { z } from "zod";
import { WEEKDAYS } from "./types";

const loadBasisSchema = z.enum([
  "total",
  "perDumbbell",
  "perSide",
  "machine",
  "bodyweight",
  "unknown",
]);

export const numericLoadSchema = z.object({
  kind: z.literal("numeric"),
  kg: z.number().finite().nonnegative(),
  basis: loadBasisSchema,
});

export const descriptiveLoadSchema = z.object({
  kind: z.literal("descriptive"),
  label: z.string().trim().min(1).max(120),
  numericEquivalentKg: z.number().finite().nonnegative().nullable(),
});

export const loadPrescriptionSchema = z
  .union([numericLoadSchema, descriptiveLoadSchema])
  .nullable();

export const profileSchema = z.object({
  displayName: z.string().max(80),
  heightCm: z.number().finite().positive(),
  weightKg: z.number().finite().positive(),
  weightUnit: z.enum(["kg", "lb"]),
  measurementUnit: z.enum(["cm", "in"]),
  timezone: z.string().min(1).max(80),
  theme: z.literal("dark"),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
});

export const preferencesSchema = z.object({
  onboardingComplete: z.boolean(),
  defaultSets: z.number().int().min(1).max(20),
  defaultReps: z.number().int().min(1).max(100),
  defaultRestSeconds: z.number().int().min(0).max(3600),
  timerSound: z.boolean(),
  timerVibration: z.boolean(),
  weekStartsOn: z.literal(1),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
});

export const initMetaSchema = z.object({
  status: z.literal("complete"),
  schemaVersion: z.number().int(),
  seedVersion: z.number().int(),
  seededAt: z.number().finite(),
  updatedAt: z.number().finite(),
});

export const exerciseDefinitionSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  category: z.enum(["push", "pull", "legs", "core", "cardio", "other"]),
  equipment: z.string().max(120),
  defaultProgressionIncrementKg: z.number().finite().nonnegative().nullable(),
  isArchived: z.boolean(),
  seeded: z.boolean(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
});

export const templateExerciseSchema = z.object({
  id: z.string().min(1).max(160),
  exerciseId: z.string().min(1).max(120),
  order: z.number().int().nonnegative(),
  targetSets: z.number().int().min(1).max(20),
  targetReps: z.number().int().min(1).max(100),
  defaultLoad: loadPrescriptionSchema,
  progressionIncrementKg: z.number().finite().nonnegative().nullable(),
  restSeconds: z.number().int().min(0).max(3600),
  note: z.string().max(500),
  enabled: z.boolean(),
});

export const workoutTemplateSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  type: z.enum(["strength", "cardio"]),
  exercises: z.array(templateExerciseSchema).max(100),
  enabled: z.boolean(),
  version: z.number().int().positive(),
  seededKey: z.string().max(80).nullable(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
});

export const scheduleEntrySchema = z.object({
  id: z.enum(WEEKDAYS),
  day: z.enum(WEEKDAYS),
  kind: z.enum(["training", "rest"]),
  templateId: z.string().max(120).nullable(),
  templateName: z.string().max(80).nullable(),
  updatedAt: z.number().finite(),
});

export const sessionSetSchema = z.object({
  id: z.string().min(1).max(160),
  order: z.number().int().nonnegative(),
  weightKg: z.number().finite().nonnegative().nullable(),
  loadDescription: z.string().max(120).nullable(),
  loadBasis: loadBasisSchema,
  reps: z.number().int().nonnegative().nullable(),
  status: z.enum(["pending", "completed", "skipped"]),
  rpe: z.number().finite().min(0).max(10).nullable(),
  note: z.string().max(500),
  completedAt: z.number().finite().nullable(),
});

export const sessionExerciseSchema = z.object({
  id: z.string().min(1).max(160),
  exerciseId: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  order: z.number().int().nonnegative(),
  targetSets: z.number().int().min(1).max(20),
  targetReps: z.number().int().min(1).max(100),
  load: loadPrescriptionSchema,
  loadBasis: loadBasisSchema,
  progressionIncrementKg: z.number().finite().nonnegative().nullable(),
  restSeconds: z.number().int().min(0).max(3600),
  note: z.string().max(500),
  enabled: z.boolean(),
  sets: z.array(sessionSetSchema).max(50),
});

export const cardioRecordSchema = z.object({
  activityType: z.string().max(80),
  durationSeconds: z.number().int().nonnegative().nullable(),
  distanceKm: z.number().finite().nonnegative().nullable(),
  avgPaceSecondsPerKm: z.number().finite().nonnegative().nullable(),
  inclinePercent: z.number().finite().nullable(),
  speedKph: z.number().finite().nonnegative().nullable(),
  equipment: z.string().max(120),
  notes: z.string().max(1000),
  intensity: z.number().int().min(1).max(10).nullable(),
});

export const summaryPrSchema = z.object({
  metric: z.enum([
    "maxWeight",
    "repsAtWeight",
    "estimated1RM",
    "exerciseVolume",
    "sessionVolume",
    "targetPerformance",
  ]),
  label: z.string(),
  value: z.number().finite(),
  unit: z.string(),
  previousValue: z.number().finite().nullable(),
  exerciseId: z.string().nullable(),
  exerciseName: z.string().nullable(),
  scopeKey: z.string(),
});

export const workoutSummarySchema = z.object({
  durationSeconds: z.number().int().nonnegative(),
  exercisesPlanned: z.number().int().nonnegative(),
  exercisesCompleted: z.number().int().nonnegative(),
  setsCompleted: z.number().int().nonnegative(),
  setsSkipped: z.number().int().nonnegative(),
  totalReps: z.number().int().nonnegative(),
  totalVolumeKg: z.number().finite().nonnegative(),
  volumeIncludedSets: z.number().int().nonnegative(),
  volumeExcludedSets: z.number().int().nonnegative(),
  prs: z.array(summaryPrSchema),
  isCardio: z.boolean(),
});

export const workoutSessionSchema = z.object({
  id: z.string().min(1).max(160),
  templateId: z.string().min(1).max(120),
  templateName: z.string().min(1).max(80),
  templateVersion: z.number().int().positive(),
  workoutType: z.enum(["strength", "cardio"]),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledDay: z.enum(WEEKDAYS),
  source: z.enum(["scheduled", "extra"]),
  status: z.enum(["active", "completed"]),
  startedAt: z.number().finite(),
  completedAt: z.number().finite().nullable(),
  timezone: z.string().min(1).max(80),
  exercises: z.array(sessionExerciseSchema).max(100),
  cardio: cardioRecordSchema.nullable(),
  notes: z.string().max(2000),
  summary: workoutSummarySchema.nullable(),
  revision: z.number().int().nonnegative(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
});

export const bodyMeasurementSchema = z.object({
  id: z.string().min(1).max(160),
  metric: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().finite().positive(),
  unit: z.enum(["kg", "cm"]),
  notes: z.string().max(1000),
  isCustom: z.boolean(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
});

export const personalRecordSchema = z.object({
  id: z.string().min(1).max(300),
  exerciseId: z.string().max(120).nullable(),
  exerciseName: z.string().max(120),
  metric: z.enum([
    "maxWeight",
    "repsAtWeight",
    "estimated1RM",
    "exerciseVolume",
    "sessionVolume",
    "targetPerformance",
  ]),
  scopeKey: z.string().max(120),
  value: z.number().finite(),
  unit: z.string().max(20),
  loadBasis: loadBasisSchema.nullable(),
  weightKg: z.number().finite().nullable(),
  reps: z.number().int().nullable(),
  achievedAt: z.number().finite(),
  sessionId: z.string().min(1).max(160),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  previousValue: z.number().finite().nullable(),
});

export const achievementSchema = z.object({
  id: z.string().min(1).max(300),
  key: z.string().min(1).max(240),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  category: z.enum(["workout", "streak", "record", "consistency", "exercise"]),
  earnedAt: z.number().finite(),
  seenAt: z.number().finite().nullable(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

const requiredNumber = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number({ error: "Enter a number" }).finite(),
);

export const signInFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signUpFormSchema = z
  .object({
    displayName: z.string().trim().max(80).optional(),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profileFormSchema = z.object({
  displayName: z.string().trim().max(80),
  heightCm: requiredNumber.pipe(z.number().positive().max(400)),
  weightKg: requiredNumber.pipe(z.number().positive().max(1000)),
  weightUnit: z.enum(["kg", "lb"]),
  measurementUnit: z.enum(["cm", "in"]),
  timezone: z.string().min(1).max(80),
});

export const preferencesFormSchema = z.object({
  defaultSets: requiredNumber.pipe(z.number().int().min(1).max(20)),
  defaultReps: requiredNumber.pipe(z.number().int().min(1).max(100)),
  defaultRestSeconds: requiredNumber.pipe(z.number().int().min(0).max(3600)),
  timerSound: z.boolean(),
  timerVibration: z.boolean(),
});

export const exerciseFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.enum(["push", "pull", "legs", "core", "cardio", "other"]),
  equipment: z.string().trim().max(120),
  progressionIncrementKg: requiredNumber.pipe(
    z.number().nonnegative().max(1000),
  ),
});

export const templateFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  type: z.enum(["strength", "cardio"]),
  enabled: z.boolean(),
  day: z.enum(WEEKDAYS).or(z.literal("none")),
});

export const bodyMeasurementFormSchema = z.object({
  metric: z.string().min(1),
  customLabel: z.string().trim().max(80).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date"),
  value: requiredNumber.pipe(z.number().positive("Enter a value above zero")),
  notes: z.string().max(1000),
});

export const cardioFormSchema = z.object({
  activityType: z.string().trim().max(80),
  durationMinutes: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().min(0).max(1440).optional(),
  ),
  durationSecondsPart: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().int().min(0).max(59).optional(),
  ),
  distanceKm: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().min(0).max(1000).optional(),
  ),
  inclinePercent: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().min(-100).max(100).optional(),
  ),
  speedKph: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().min(0).max(200).optional(),
  ),
  equipment: z.string().trim().max(120),
  notes: z.string().max(1000),
  intensity: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().int().min(1).max(10).optional(),
  ),
});

export type SignInValues = z.infer<typeof signInFormSchema>;
export type SignUpValues = z.infer<typeof signUpFormSchema>;
export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;
export type ExerciseFormValues = z.infer<typeof exerciseFormSchema>;
export type TemplateFormValues = z.infer<typeof templateFormSchema>;
export type BodyMeasurementFormValues = z.infer<typeof bodyMeasurementFormSchema>;
export type CardioFormValues = z.infer<typeof cardioFormSchema>;
