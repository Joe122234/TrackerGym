import type {
  ExerciseDefinition,
  LoadPrescription,
  ScheduleEntry,
  TemplateExercise,
  Weekday,
  WorkoutTemplate,
} from "./types";
import { WEEKDAYS } from "./types";

export const SEED_VERSION = 1;
export const DEFAULT_REST_SECONDS = 90;
export const DEFAULT_SETS = 2;
export const DEFAULT_REPS = 8;

export const SEED_TEMPLATE_IDS = {
  mondayPush: "tpl_monday_push",
  tuesdayPull: "tpl_tuesday_pull",
  wednesdayLegs: "tpl_wednesday_legs",
  thursdayCardio: "tpl_thursday_cardio",
  fridayUpper: "tpl_friday_upper",
  saturdayLegs: "tpl_saturday_legs",
} as const;

interface SeedExercise {
  id: string;
  name: string;
  category: ExerciseDefinition["category"];
  equipment: string;
  defaultProgressionIncrementKg: number | null;
}

export const SEED_EXERCISES: SeedExercise[] = [
  {
    id: "ex_lateral_raise_abductor_machine",
    name: "Lateral Raise of Abductor Machine",
    category: "push",
    equipment: "Abductor machine",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_smith_machine_shoulder_press",
    name: "Smith Machine Shoulder Press",
    category: "push",
    equipment: "Smith machine",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_front_delt_raise",
    name: "Front Delt Raise",
    category: "push",
    equipment: "Cable / machine",
    defaultProgressionIncrementKg: 2,
  },
  {
    id: "ex_pec_deck",
    name: "Pec Deck",
    category: "push",
    equipment: "Machine",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_incline_machine_press",
    name: "Incline Machine Press",
    category: "push",
    equipment: "Machine",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_tricep_single_arm_carter_extensions",
    name: "Tricep Single Arm Carter Extensions",
    category: "push",
    equipment: "Cable",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_v_bar_press",
    name: "V-Bar Press",
    category: "push",
    equipment: "Cable",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_jm_press",
    name: "JM Press",
    category: "push",
    equipment: "Machine / cable",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_close_grip_pull_down",
    name: "Close Grip Pull Down",
    category: "pull",
    equipment: "Cable",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_dumbbell_chest_supported_row",
    name: "Dumbbell Chest Supported Row",
    category: "pull",
    equipment: "Dumbbell + bench",
    defaultProgressionIncrementKg: 2,
  },
  {
    id: "ex_close_grip_sitting_row",
    name: "Close Grip Sitting Row",
    category: "pull",
    equipment: "Cable machine",
    defaultProgressionIncrementKg: null,
  },
  {
    id: "ex_back_extensions",
    name: "Back Extensions",
    category: "pull",
    equipment: "Back extension bench + plates",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_hammer_cable_single_arm_cuff_curls",
    name: "Hammer Cable Single Arm Cuff Curls",
    category: "pull",
    equipment: "Cable",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_forearm_tnf_curls",
    name: "Forearm TNF Curls",
    category: "pull",
    equipment: "Cable",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_single_arm_rear_delt_flies",
    name: "Single Arm Rear Delt Flies",
    category: "pull",
    equipment: "Cable",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_smith_machine_squat",
    name: "Smith Machine Squat",
    category: "legs",
    equipment: "Smith machine",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_sldl",
    name: "SLDL",
    category: "legs",
    equipment: "Barbell",
    defaultProgressionIncrementKg: 2.5,
  },
  {
    id: "ex_good_girl_abductor_machine",
    name: "Good Girl Abductor Machine",
    category: "legs",
    equipment: "Abductor machine",
    defaultProgressionIncrementKg: null,
  },
  {
    id: "ex_leg_press",
    name: "Leg Press",
    category: "legs",
    equipment: "Leg press machine",
    defaultProgressionIncrementKg: 5,
  },
  {
    id: "ex_cable_abs_crunch",
    name: "Cable Abs Crunch",
    category: "core",
    equipment: "Cable",
    defaultProgressionIncrementKg: 2.5,
  },
];

const numeric = (
  kg: number,
  basis: "total" | "perDumbbell" | "machine" = "machine",
): LoadPrescription => ({ kind: "numeric", kg, basis });

const DUMBBELL_ROW_NOTE = "35 kg refers to each dumbbell.";
const BACK_EXTENSION_NOTE = "Starting load is 20 kg in plates.";
const DESCRIPTIVE_ROW_NOTE = "Starting configuration: full stack + 15 kg.";
const DESCRIPTIVE_ABDUCTOR_NOTE = "Starting configuration: full stack + 20 kg.";

interface SeedEntry {
  exerciseId: string;
  targetSets?: number;
  targetReps?: number;
  defaultLoad: LoadPrescription;
  note?: string;
  progressionIncrementKg?: number | null;
}

interface SeedTemplate {
  id: string;
  name: string;
  type: WorkoutTemplate["type"];
  seededKey: string;
  exercises: SeedEntry[];
}

const pushEntries: SeedEntry[] = [
  {
    exerciseId: "ex_lateral_raise_abductor_machine",
    defaultLoad: numeric(49),
  },
  {
    exerciseId: "ex_smith_machine_shoulder_press",
    defaultLoad: numeric(40),
  },
  {
    exerciseId: "ex_front_delt_raise",
    defaultLoad: numeric(27),
    progressionIncrementKg: 2,
  },
  {
    exerciseId: "ex_pec_deck",
    defaultLoad: numeric(70),
  },
  {
    exerciseId: "ex_incline_machine_press",
    defaultLoad: numeric(90),
  },
  {
    exerciseId: "ex_tricep_single_arm_carter_extensions",
    defaultLoad: numeric(37),
  },
  {
    exerciseId: "ex_v_bar_press",
    targetSets: 1,
    defaultLoad: numeric(67),
  },
  {
    exerciseId: "ex_jm_press",
    defaultLoad: numeric(10),
  },
];

const pullEntries: SeedEntry[] = [
  {
    exerciseId: "ex_close_grip_pull_down",
    defaultLoad: numeric(70),
  },
  {
    exerciseId: "ex_dumbbell_chest_supported_row",
    defaultLoad: numeric(35, "perDumbbell"),
    note: DUMBBELL_ROW_NOTE,
    progressionIncrementKg: 2,
  },
  {
    exerciseId: "ex_close_grip_sitting_row",
    defaultLoad: {
      kind: "descriptive",
      label: "Full stack + 15 kg",
      numericEquivalentKg: null,
    },
    note: DESCRIPTIVE_ROW_NOTE,
    progressionIncrementKg: null,
  },
  {
    exerciseId: "ex_back_extensions",
    defaultLoad: numeric(20, "total"),
    note: BACK_EXTENSION_NOTE,
  },
  {
    exerciseId: "ex_hammer_cable_single_arm_cuff_curls",
    defaultLoad: numeric(37),
  },
  {
    exerciseId: "ex_forearm_tnf_curls",
    defaultLoad: numeric(47),
  },
  {
    exerciseId: "ex_single_arm_rear_delt_flies",
    defaultLoad: numeric(57),
  },
];

const legEntries: SeedEntry[] = [
  {
    exerciseId: "ex_smith_machine_squat",
    defaultLoad: numeric(70),
  },
  {
    exerciseId: "ex_sldl",
    defaultLoad: numeric(30),
  },
  {
    exerciseId: "ex_good_girl_abductor_machine",
    defaultLoad: {
      kind: "descriptive",
      label: "Full stack + 20 kg",
      numericEquivalentKg: null,
    },
    note: DESCRIPTIVE_ABDUCTOR_NOTE,
    progressionIncrementKg: null,
  },
  {
    exerciseId: "ex_leg_press",
    defaultLoad: null,
    progressionIncrementKg: 5,
  },
  {
    exerciseId: "ex_cable_abs_crunch",
    defaultLoad: numeric(47),
  },
];

const fridayEntries: SeedEntry[] = [
  ...pushEntries.filter((entry) => entry.exerciseId !== "ex_jm_press"),
  {
    exerciseId: "ex_close_grip_pull_down",
    defaultLoad: numeric(70),
  },
  {
    exerciseId: "ex_dumbbell_chest_supported_row",
    defaultLoad: numeric(35, "perDumbbell"),
    note: DUMBBELL_ROW_NOTE,
    progressionIncrementKg: 2,
  },
  {
    exerciseId: "ex_hammer_cable_single_arm_cuff_curls",
    defaultLoad: numeric(37),
  },
  {
    exerciseId: "ex_forearm_tnf_curls",
    defaultLoad: numeric(47),
  },
  {
    exerciseId: "ex_single_arm_rear_delt_flies",
    defaultLoad: numeric(57),
  },
];

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    id: SEED_TEMPLATE_IDS.mondayPush,
    name: "Push",
    type: "strength",
    seededKey: "monday_push",
    exercises: pushEntries,
  },
  {
    id: SEED_TEMPLATE_IDS.tuesdayPull,
    name: "Pull",
    type: "strength",
    seededKey: "tuesday_pull",
    exercises: pullEntries,
  },
  {
    id: SEED_TEMPLATE_IDS.wednesdayLegs,
    name: "Legs",
    type: "strength",
    seededKey: "wednesday_legs",
    exercises: legEntries,
  },
  {
    id: SEED_TEMPLATE_IDS.thursdayCardio,
    name: "Cardio",
    type: "cardio",
    seededKey: "thursday_cardio",
    exercises: [],
  },
  {
    id: SEED_TEMPLATE_IDS.fridayUpper,
    name: "Upper",
    type: "strength",
    seededKey: "friday_upper",
    exercises: fridayEntries,
  },
  {
    id: SEED_TEMPLATE_IDS.saturdayLegs,
    name: "Legs",
    type: "strength",
    seededKey: "saturday_legs",
    exercises: legEntries,
  },
];

export const SEED_SCHEDULE: Array<{
  day: Weekday;
  templateId: string | null;
  templateName: string | null;
  kind: ScheduleEntry["kind"];
}> = [
  {
    day: "monday",
    templateId: SEED_TEMPLATE_IDS.mondayPush,
    templateName: "Push",
    kind: "training",
  },
  {
    day: "tuesday",
    templateId: SEED_TEMPLATE_IDS.tuesdayPull,
    templateName: "Pull",
    kind: "training",
  },
  {
    day: "wednesday",
    templateId: SEED_TEMPLATE_IDS.wednesdayLegs,
    templateName: "Legs",
    kind: "training",
  },
  {
    day: "thursday",
    templateId: SEED_TEMPLATE_IDS.thursdayCardio,
    templateName: "Cardio",
    kind: "training",
  },
  {
    day: "friday",
    templateId: SEED_TEMPLATE_IDS.fridayUpper,
    templateName: "Upper",
    kind: "training",
  },
  {
    day: "saturday",
    templateId: SEED_TEMPLATE_IDS.saturdayLegs,
    templateName: "Legs",
    kind: "training",
  },
  {
    day: "sunday",
    templateId: null,
    templateName: null,
    kind: "rest",
  },
];

export function seedExerciseDefinitions(now: number): ExerciseDefinition[] {
  return SEED_EXERCISES.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    equipment: exercise.equipment,
    defaultProgressionIncrementKg: exercise.defaultProgressionIncrementKg,
    isArchived: false,
    seeded: true,
    createdAt: now,
    updatedAt: now,
  }));
}

export function seedWorkoutTemplates(now: number): WorkoutTemplate[] {
  return SEED_TEMPLATES.map((template) => {
    const exercises: TemplateExercise[] = template.exercises.map(
      (entry, index) => {
        const definition = SEED_EXERCISES.find(
          (candidate) => candidate.id === entry.exerciseId,
        );
        if (!definition) {
          throw new Error(`Missing seed exercise ${entry.exerciseId}`);
        }
        return {
          id: `te_${template.id}_${entry.exerciseId}`,
          exerciseId: entry.exerciseId,
          order: index,
          targetSets: entry.targetSets ?? DEFAULT_SETS,
          targetReps: entry.targetReps ?? DEFAULT_REPS,
          defaultLoad: entry.defaultLoad,
          progressionIncrementKg:
            entry.progressionIncrementKg === undefined
              ? definition.defaultProgressionIncrementKg
              : entry.progressionIncrementKg,
          restSeconds: DEFAULT_REST_SECONDS,
          note: entry.note ?? "",
          enabled: true,
        };
      },
    );

    return {
      id: template.id,
      name: template.name,
      type: template.type,
      exercises,
      enabled: true,
      version: 1,
      seededKey: template.seededKey,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function seedSchedule(now: number): ScheduleEntry[] {
  return SEED_SCHEDULE.map((entry) => ({
    id: entry.day,
    day: entry.day,
    kind: entry.kind,
    templateId: entry.templateId,
    templateName: entry.templateName,
    updatedAt: now,
  }));
}

export const SEED_WEEKDAYS = WEEKDAYS;
