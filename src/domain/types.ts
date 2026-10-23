export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export type WeightUnit = "kg" | "lb";
export type MeasurementUnit = "cm" | "in";
export type WorkoutType = "strength" | "cardio";
export type ScheduleKind = "training" | "rest";
export type SessionStatus = "active" | "completed";
export type SessionSource = "scheduled" | "extra";
export type SetStatus = "pending" | "completed" | "skipped";

/**
 * Canonical loads are always stored in kg. A descriptive load is preserved
 * exactly; it is never silently converted into a numeric load.
 */
export type LoadBasis =
  | "total"
  | "perDumbbell"
  | "perSide"
  | "machine"
  | "bodyweight"
  | "unknown";

export interface NumericLoad {
  kind: "numeric";
  kg: number;
  basis: LoadBasis;
}

export interface DescriptiveLoad {
  kind: "descriptive";
  label: string;
  numericEquivalentKg: number | null;
}

export type LoadPrescription = NumericLoad | DescriptiveLoad | null;

export interface ExerciseDefinition {
  id: string;
  name: string;
  category: "push" | "pull" | "legs" | "core" | "cardio" | "other";
  equipment: string;
  defaultProgressionIncrementKg: number | null;
  isArchived: boolean;
  seeded: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateExercise {
  /** Stable entry ID, unique within the template. */
  id: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: number;
  defaultLoad: LoadPrescription;
  progressionIncrementKg: number | null;
  restSeconds: number;
  note: string;
  enabled: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  type: WorkoutType;
  exercises: TemplateExercise[];
  enabled: boolean;
  version: number;
  seededKey: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleEntry {
  id: Weekday;
  day: Weekday;
  kind: ScheduleKind;
  templateId: string | null;
  templateName: string | null;
  updatedAt: number;
}

export interface SessionSet {
  id: string;
  order: number;
  weightKg: number | null;
  loadDescription: string | null;
  loadBasis: LoadBasis;
  reps: number | null;
  status: SetStatus;
  rpe: number | null;
  note: string;
  completedAt: number | null;
}

export interface SessionExercise {
  /** Snapshot of the template entry at session creation. */
  id: string;
  exerciseId: string;
  name: string;
  order: number;
  targetSets: number;
  targetReps: number;
  load: LoadPrescription;
  loadBasis: LoadBasis;
  progressionIncrementKg: number | null;
  restSeconds: number;
  note: string;
  enabled: boolean;
  sets: SessionSet[];
}

export interface CardioRecord {
  activityType: string;
  durationSeconds: number | null;
  distanceKm: number | null;
  avgPaceSecondsPerKm: number | null;
  inclinePercent: number | null;
  speedKph: number | null;
  equipment: string;
  notes: string;
  intensity: number | null;
}

export interface SummaryPr {
  metric: PersonalRecordMetric;
  label: string;
  value: number;
  unit: string;
  previousValue: number | null;
  exerciseId: string | null;
  exerciseName: string | null;
  scopeKey: string;
}

export interface WorkoutSummary {
  durationSeconds: number;
  exercisesPlanned: number;
  exercisesCompleted: number;
  setsCompleted: number;
  setsSkipped: number;
  totalReps: number;
  totalVolumeKg: number;
  volumeIncludedSets: number;
  volumeExcludedSets: number;
  prs: SummaryPr[];
  isCardio: boolean;
}

export interface WorkoutSession {
  id: string;
  templateId: string;
  templateName: string;
  templateVersion: number;
  workoutType: WorkoutType;
  scheduledDate: string;
  scheduledDay: Weekday;
  source: SessionSource;
  status: SessionStatus;
  startedAt: number;
  completedAt: number | null;
  timezone: string;
  exercises: SessionExercise[];
  cardio: CardioRecord | null;
  notes: string;
  summary: WorkoutSummary | null;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface Profile {
  displayName: string;
  heightCm: number;
  weightKg: number;
  weightUnit: WeightUnit;
  measurementUnit: MeasurementUnit;
  timezone: string;
  theme: "dark";
  createdAt: number;
  updatedAt: number;
}

export interface Preferences {
  onboardingComplete: boolean;
  defaultSets: number;
  defaultReps: number;
  defaultRestSeconds: number;
  timerSound: boolean;
  timerVibration: boolean;
  weekStartsOn: 1;
  createdAt: number;
  updatedAt: number;
}

export interface InitMeta {
  status: "complete";
  schemaVersion: number;
  seedVersion: number;
  seededAt: number;
  updatedAt: number;
}

export interface BodyMeasurement {
  id: string;
  /** Built-in metric key or `custom:<slug>`. Weight is stored in kg, lengths in cm. */
  metric: string;
  label: string;
  date: string;
  value: number;
  unit: "kg" | "cm";
  notes: string;
  isCustom: boolean;
  createdAt: number;
  updatedAt: number;
}

export type PersonalRecordMetric =
  | "maxWeight"
  | "repsAtWeight"
  | "estimated1RM"
  | "exerciseVolume"
  | "sessionVolume"
  | "targetPerformance";

export interface PersonalRecord {
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
  previousValue: number | null;
}

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  category:
    | "workout"
    | "streak"
    | "record"
    | "consistency"
    | "exercise";
  earnedAt: number;
  seenAt: number | null;
  metadata: Record<string, string | number | null>;
}

export interface AttendanceDay {
  date: string;
  day: Weekday;
  kind: ScheduleKind;
  status: "completed" | "missed" | "today" | "upcoming" | "rest";
  hasExtraSession: boolean;
  sessionIds: string[];
  templateId: string | null;
  templateName: string | null;
}

export interface RecoveryDraft {
  session: WorkoutSession;
  savedAt: number;
}

export function isNumericLoad(load: LoadPrescription): load is NumericLoad {
  return load?.kind === "numeric";
}

export function loadBasisOf(load: LoadPrescription): LoadBasis {
  if (!load) return "unknown";
  return load.kind === "numeric" ? load.basis : "unknown";
}

export function isDescriptiveLoad(
  load: LoadPrescription,
): load is DescriptiveLoad {
  return load?.kind === "descriptive";
}
