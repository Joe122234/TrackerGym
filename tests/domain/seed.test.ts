import { describe, expect, it } from "vitest";
import {
  SEED_SCHEDULE,
  SEED_TEMPLATES,
  seedExerciseDefinitions,
  seedSchedule,
  seedWorkoutTemplates,
} from "@/domain/seed";
import { workoutTemplateSchema } from "@/domain/schemas";

const NOW = 1_767_600_000_000;

describe("starting split", () => {
  it("creates six templates and seven schedule days", () => {
    expect(seedWorkoutTemplates(NOW)).toHaveLength(6);
    expect(seedExerciseDefinitions(NOW).length).toBeGreaterThan(10);
    expect(seedSchedule(NOW)).toHaveLength(7);
  });

  it("matches the exact weekly schedule with Sunday rest", () => {
    expect(SEED_SCHEDULE.map((entry) => entry.day)).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]);
    expect(SEED_SCHEDULE.find((entry) => entry.day === "sunday")?.kind).toBe(
      "rest",
    );
    expect(SEED_SCHEDULE.find((entry) => entry.day === "sunday")?.templateId).toBeNull();
  });

  it("uses the exact exercise counts for each day", () => {
    const templates = seedWorkoutTemplates(NOW);
    const counts = Object.fromEntries(
      templates.map((template) => [
        template.id,
        template.exercises.filter((exercise) => exercise.enabled).length,
      ]),
    );
    expect(counts).toMatchObject({
      tpl_monday_push: 8,
      tpl_tuesday_pull: 7,
      tpl_wednesday_legs: 5,
      tpl_thursday_cardio: 0,
      tpl_friday_upper: 12,
      tpl_saturday_legs: 5,
    });
  });

  it("keeps Thursday as a cardio session", () => {
    const cardio = seedWorkoutTemplates(NOW).find(
      (template) => template.id === "tpl_thursday_cardio",
    );
    expect(cardio?.type).toBe("cardio");
    expect(cardio?.exercises).toEqual([]);
  });

  it("keeps V-Bar Press at one set", () => {
    const push = seedWorkoutTemplates(NOW).find(
      (template) => template.id === "tpl_monday_push",
    );
    const vBar = push?.exercises.find(
      (exercise) => exercise.exerciseId === "ex_v_bar_press",
    );
    expect(vBar?.targetSets).toBe(1);
  });

  it("leaves Leg Press without a numeric starting load", () => {
    const legs = seedWorkoutTemplates(NOW).find(
      (template) => template.id === "tpl_wednesday_legs",
    );
    const legPress = legs?.exercises.find(
      (exercise) => exercise.exerciseId === "ex_leg_press",
    );
    expect(legPress?.defaultLoad).toBeNull();
    expect(legPress?.progressionIncrementKg).toBe(5);
  });

  it("preserves the descriptive starting configurations", () => {
    const pull = seedWorkoutTemplates(NOW).find(
      (template) => template.id === "tpl_tuesday_pull",
    );
    const row = pull?.exercises.find(
      (exercise) => exercise.exerciseId === "ex_close_grip_sitting_row",
    );
    expect(row?.defaultLoad).toEqual({
      kind: "descriptive",
      label: "Full stack + 15 kg",
      numericEquivalentKg: null,
    });

    const legs = seedWorkoutTemplates(NOW).find(
      (template) => template.id === "tpl_wednesday_legs",
    );
    const goodGirl = legs?.exercises.find(
      (exercise) =>
        exercise.exerciseId === "ex_good_girl_abductor_machine",
    );
    expect(goodGirl?.defaultLoad).toEqual({
      kind: "descriptive",
      label: "Full stack + 20 kg",
      numericEquivalentKg: null,
    });
  });

  it("stores the dumbbell row per dumbbell and preserves its note", () => {
    const pull = seedWorkoutTemplates(NOW).find(
      (template) => template.id === "tpl_tuesday_pull",
    );
    const row = pull?.exercises.find(
      (exercise) =>
        exercise.exerciseId === "ex_dumbbell_chest_supported_row",
    );
    expect(row?.defaultLoad).toEqual({
      kind: "numeric",
      kg: 35,
      basis: "perDumbbell",
    });
    expect(row?.note).toContain("each dumbbell");
  });

  it("preserves the Back Extensions plate note", () => {
    const pull = seedWorkoutTemplates(NOW).find(
      (template) => template.id === "tpl_tuesday_pull",
    );
    const backExtensions = pull?.exercises.find(
      (exercise) => exercise.exerciseId === "ex_back_extensions",
    );
    expect(backExtensions?.note).toContain("20 kg");
  });

  it("keeps Friday's exclusions exact", () => {
    const friday = seedWorkoutTemplates(NOW).find(
      (template) => template.id === "tpl_friday_upper",
    );
    const ids = friday?.exercises.map((exercise) => exercise.exerciseId) ?? [];
    expect(ids).not.toContain("ex_jm_press");
    expect(ids).not.toContain("ex_close_grip_sitting_row");
    expect(ids).not.toContain("ex_back_extensions");
    expect(ids).toContain("ex_v_bar_press");
    expect(ids).toContain("ex_close_grip_pull_down");
    expect(ids).toContain("ex_dumbbell_chest_supported_row");
  });

  it("references only real seeded exercise definitions", () => {
    const definitions = new Set(
      seedExerciseDefinitions(NOW).map((definition) => definition.id),
    );
    for (const template of seedWorkoutTemplates(NOW)) {
      for (const exercise of template.exercises) {
        expect(definitions.has(exercise.exerciseId)).toBe(true);
      }
    }
  });

  it("produces documents accepted by the persisted schemas", () => {
    for (const template of seedWorkoutTemplates(NOW)) {
      expect(workoutTemplateSchema.safeParse(template).success).toBe(true);
    }
    for (const entry of seedSchedule(NOW)) {
      expect(entry.id).toBe(entry.day);
      expect(entry.updatedAt).toBe(NOW);
    }
  });

  it("does not include any fabricated session data", () => {
    expect(Object.keys(SEED_TEMPLATES).sort()).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(SEED_SCHEDULE.some((entry) => "sessions" in entry)).toBe(false);
  });
});
