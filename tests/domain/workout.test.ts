import { describe, expect, it } from "vitest";
import type { WorkoutTemplate } from "@/domain/types";
import { seedExerciseDefinitions, seedWorkoutTemplates } from "@/domain/seed";
import {
  calculateElapsedSeconds,
  createSetForExercise,
  createWorkoutSession,
  findBestSetForExercise,
  findLastExercisePerformance,
  getSessionSetCounts,
  getSummaryDurationSeconds,
  getTotalCompletedReps,
  getTotalVolumeKg,
  normalizeSessionAfterSetChanges,
  summarizeSession,
} from "@/domain/workout";
import { makeExercise, makeSession, makeSet } from "../test-factories";

const NOW = Date.UTC(2026, 0, 5, 10, 0);
const definitions = seedExerciseDefinitions(NOW);
const templates = seedWorkoutTemplates(NOW);

function pushTemplate(): WorkoutTemplate {
  const template = templates.find((entry) => entry.id === "tpl_monday_push");
  if (!template) throw new Error("Push template missing");
  return template;
}

function legsTemplate(): WorkoutTemplate {
  const template = templates.find((entry) => entry.id === "tpl_wednesday_legs");
  if (!template) throw new Error("Legs template missing");
  return template;
}

describe("session creation", () => {
  it("creates an active session with independently editable sets", () => {
    const session = createWorkoutSession({
      template: pushTemplate(),
      definitions,
      source: "scheduled",
      timezone: "Asia/Bangkok",
      now: NOW,
      id: "session_1",
    });
    expect(session.status).toBe("active");
    expect(session.exercises).toHaveLength(8);
    expect(session.exercises.every((exercise) => exercise.sets.length > 0)).toBe(
      true,
    );
    expect(
      session.exercises.every((exercise) =>
        exercise.sets.every(
          (set) =>
            set.status === "pending" &&
            set.reps === null &&
            set.completedAt === null,
        ),
      ),
    ).toBe(true);
    expect(session.exercises[0].sets).toHaveLength(2);
    expect(
      session.exercises.find(
        (exercise) => exercise.exerciseId === "ex_v_bar_press",
      )?.sets,
    ).toHaveLength(1);
  });

  it("snapshots the template name and version", () => {
    const template = pushTemplate();
    const session = createWorkoutSession({
      template,
      definitions,
      source: "extra",
      timezone: "Asia/Bangkok",
      now: NOW,
    });
    expect(session.templateName).toBe(template.name);
    expect(session.templateVersion).toBe(template.version);
    expect(session.source).toBe("extra");
  });

  it("copies the load prescription so later template edits cannot mutate history", () => {
    const template = pushTemplate();
    const session = createWorkoutSession({
      template,
      definitions,
      source: "scheduled",
      timezone: "Asia/Bangkok",
      now: NOW,
    });
    const exercise = session.exercises[0];
    const originalLoad = JSON.parse(JSON.stringify(exercise.load));
    if (exercise.load?.kind === "numeric") {
      exercise.load.kg = 999;
    }
    expect(template.exercises[0].defaultLoad).toEqual(originalLoad);
  });

  it("creates a blank cardio record for cardio templates", () => {
    const cardio = templates.find((entry) => entry.id === "tpl_thursday_cardio");
    if (!cardio) throw new Error("Cardio template missing");
    const session = createWorkoutSession({
      template: cardio,
      definitions,
      source: "scheduled",
      timezone: "Asia/Bangkok",
      now: NOW,
    });
    expect(session.workoutType).toBe("cardio");
    expect(session.exercises).toEqual([]);
    expect(session.cardio).toMatchObject({
      activityType: "",
      durationSeconds: null,
      distanceKm: null,
    });
  });

  it("uses descriptive load text without turning it into a number", () => {
    const template = legsTemplate();
    const session = createWorkoutSession({
      template,
      definitions,
      source: "scheduled",
      timezone: "Asia/Bangkok",
      now: NOW,
    });
    const goodGirl = session.exercises.find(
      (exercise) => exercise.exerciseId === "ex_good_girl_abductor_machine",
    );
    expect(goodGirl?.load).toEqual({
      kind: "descriptive",
      label: "Full stack + 20 kg",
      numericEquivalentKg: null,
    });
    expect(goodGirl?.sets[0].weightKg).toBeNull();
    expect(goodGirl?.sets[0].loadDescription).toBe("Full stack + 20 kg");
  });

  it("clones the previous set weight when adding a set", () => {
    const exercise = makeExercise({
      load: { kind: "numeric", kg: 80, basis: "total" },
      sets: [
        makeSet({ weightKg: 90, reps: 5 }),
        makeSet({ weightKg: 95, reps: 5 }),
      ],
    });
    const set = createSetForExercise(exercise, exercise.sets.length);
    expect(set.weightKg).toBe(95);
    expect(set.reps).toBeNull();
    expect(set.status).toBe("pending");
    expect(set.order).toBe(2);
  });
});

describe("session calculations", () => {
  it("calculates volume from completed numeric sets only", () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          sets: [
            makeSet({ weightKg: 100, reps: 8 }),
            makeSet({ weightKg: 90, reps: 10 }),
            makeSet({ weightKg: 120, reps: 20, status: "skipped" }),
            makeSet({ weightKg: null, reps: 12, status: "pending" }),
          ],
        }),
      ],
    });
    expect(getTotalVolumeKg(session)).toBe(1700);
    expect(getSessionSetCounts(session)).toEqual({
      completed: 2,
      skipped: 1,
      pending: 1,
      total: 4,
    });
    expect(getTotalCompletedReps(session)).toBe(18);
  });

  it("counts zero-weight completed sets as completed volume without error", () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          sets: [makeSet({ weightKg: 0, reps: 10 })],
        }),
      ],
    });
    expect(getTotalVolumeKg(session)).toBe(0);
    expect(getSessionSetCounts(session).completed).toBe(1);
  });

  it("summarizes duration from completedAt and excludes incomplete sets", () => {
    const session = makeSession({
      startedAt: NOW,
      completedAt: NOW + 3_725_000,
      exercises: [
        makeExercise({
          sets: [
            makeSet({ weightKg: 50, reps: 10 }),
            makeSet({ weightKg: 50, reps: 10, status: "skipped" }),
            makeSet({ weightKg: 50, reps: null, status: "completed" }),
          ],
        }),
      ],
    });
    const summary = summarizeSession(session, [], NOW + 10_000_000);
    expect(summary.durationSeconds).toBe(3725);
    expect(summary.setsCompleted).toBe(2);
    expect(summary.setsSkipped).toBe(1);
    expect(summary.totalVolumeKg).toBe(500);
    expect(summary.volumeIncludedSets).toBe(1);
    expect(summary.volumeExcludedSets).toBe(1);
  });

  it("computes elapsed time without going negative", () => {
    expect(calculateElapsedSeconds(NOW, NOW + 65_000)).toBe(65);
    expect(calculateElapsedSeconds(NOW, NOW - 10_000)).toBe(0);
    expect(
      getSummaryDurationSeconds({ startedAt: NOW, completedAt: NOW + 1000 }),
    ).toBe(1);
  });

  it("increments revision and normalizes set order", () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          sets: [
            makeSet({ order: 5 }),
            makeSet({ order: 9 }),
          ],
        }),
      ],
    });
    const next = normalizeSessionAfterSetChanges(session, session.exercises);
    expect(next.revision).toBe(2);
    expect(next.exercises[0].order).toBe(0);
    expect(next.exercises[0].sets.map((set) => set.order)).toEqual([0, 1]);
  });
});

describe("history lookup", () => {
  it("finds the latest completed performance and excludes the current session", () => {
    const older = makeSession({
      id: "older",
      scheduledDate: "2026-01-01",
      exercises: [
        makeExercise({
          exerciseId: "ex_press",
          sets: [makeSet({ weightKg: 80, reps: 8 })],
        }),
      ],
    });
    const newer = makeSession({
      id: "newer",
      scheduledDate: "2026-01-05",
      exercises: [
        makeExercise({
          exerciseId: "ex_press",
          sets: [makeSet({ weightKg: 90, reps: 6 })],
        }),
      ],
    });
    const active = makeSession({
      id: "active",
      status: "active",
      scheduledDate: "2026-01-06",
      exercises: [
        makeExercise({
          exerciseId: "ex_press",
          sets: [makeSet({ weightKg: 95, reps: 5 })],
        }),
      ],
    });
    const last = findLastExercisePerformance(
      [older, newer, active],
      "ex_press",
    );
    expect(last?.sessionId).toBe("newer");
    expect(last?.sets[0].weightKg).toBe(90);
    expect(
      findLastExercisePerformance([older, newer], "ex_press", "newer")?.sessionId,
    ).toBe("older");
  });

  it("selects the heaviest best set with reps as the tie-break", () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          sets: [
            makeSet({ weightKg: 100, reps: 5 }),
            makeSet({ weightKg: 100, reps: 8 }),
            makeSet({ weightKg: 90, reps: 12 }),
            makeSet({ weightKg: 120, reps: 3, status: "skipped" }),
          ],
        }),
      ],
    });
    const best = findBestSetForExercise(
      session,
      session.exercises[0].exerciseId,
    );
    expect(best?.weightKg).toBe(100);
    expect(best?.reps).toBe(8);
  });
});
