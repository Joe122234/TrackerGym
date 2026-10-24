import { describe, expect, it } from "vitest";
import type {
  BodyMeasurement,
  ExerciseDefinition,
  ScheduleEntry,
} from "@/domain/types";
import {
  bestSetForRepTarget,
  buildExerciseProgressRows,
  buildMuscleBalance,
  buildRecap,
  buildSessionRecap,
  formatRecapText,
  groupRecapPrs,
  liftBoardBounds,
} from "@/domain/insights";
import { buildPersonalRecords } from "@/domain/records";
import { makeExercise, makeSession, makeSet } from "../test-factories";

const PROFILE = {
  displayName: "Henry",
  heightCm: 172,
  weightKg: 69,
  weightUnit: "kg" as const,
  measurementUnit: "cm" as const,
  timezone: "Asia/Bangkok",
  theme: "dark" as const,
  createdAt: Date.UTC(2026, 0, 1),
  updatedAt: Date.UTC(2026, 0, 1),
};

const DEFINITIONS: ExerciseDefinition[] = [
  {
    id: "ex_bench",
    name: "Bench Press",
    category: "push",
    equipment: "barbell",
    defaultProgressionIncrementKg: 2.5,
    isArchived: false,
    seeded: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "ex_row",
    name: "Cable Row",
    category: "pull",
    equipment: "cable",
    defaultProgressionIncrementKg: 2.5,
    isArchived: false,
    seeded: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "ex_squat",
    name: "Squat",
    category: "legs",
    equipment: "barbell",
    defaultProgressionIncrementKg: 2.5,
    isArchived: false,
    seeded: true,
    createdAt: 0,
    updatedAt: 0,
  },
];

const SCHEDULE: ScheduleEntry[] = [
  {
    id: "monday",
    day: "monday",
    kind: "training",
    templateId: "tpl_upper",
    templateName: "Upper",
    updatedAt: 0,
  },
  {
    id: "wednesday",
    day: "wednesday",
    kind: "training",
    templateId: "tpl_upper",
    templateName: "Upper",
    updatedAt: 0,
  },
  {
    id: "friday",
    day: "friday",
    kind: "training",
    templateId: "tpl_upper",
    templateName: "Upper",
    updatedAt: 0,
  },
  {
    id: "sunday",
    day: "sunday",
    kind: "rest",
    templateId: null,
    templateName: null,
    updatedAt: 0,
  },
];

const MEASUREMENTS: BodyMeasurement[] = [
  {
    id: "m1",
    metric: "bodyWeight",
    label: "Body weight",
    date: "2026-01-05",
    value: 69,
    unit: "kg",
    notes: "",
    isCustom: false,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "m2",
    metric: "bodyWeight",
    label: "Body weight",
    date: "2026-01-19",
    value: 68.4,
    unit: "kg",
    notes: "",
    isCustom: false,
    createdAt: 2,
    updatedAt: 2,
  },
];

function benchSession(
  date: string,
  weightKg: number,
  reps = 8,
): ReturnType<typeof makeSession> {
  return makeSession({
    scheduledDate: date,
    templateName: "Upper",
    exercises: [
      makeExercise({
        exerciseId: "ex_bench",
        name: "Bench Press",
        targetSets: 3,
        targetReps: 8,
        sets: [makeSet({ weightKg, reps })],
      }),
    ],
  });
}

describe("8-rep insights", () => {
  it("prefers an exact 8-rep set over a heavier low-rep set", () => {
    const exercise = makeExercise({
      sets: [
        makeSet({ weightKg: 100, reps: 8 }),
        makeSet({ weightKg: 120, reps: 3 }),
      ],
    });
    expect(bestSetForRepTarget(exercise)?.weightKg).toBe(100);
    expect(bestSetForRepTarget(exercise)?.reps).toBe(8);
  });

  it("falls back to a higher rep count when no exact 8 exists", () => {
    const exercise = makeExercise({
      sets: [
        makeSet({ weightKg: 80, reps: 6 }),
        makeSet({ weightKg: 70, reps: 10 }),
      ],
    });
    expect(bestSetForRepTarget(exercise)?.weightKg).toBe(70);
  });

  it("calculates period progress and delta from best 8-rep sets", () => {
    const sessions = [
      benchSession("2026-01-05", 80),
      benchSession("2026-01-12", 82.5),
      benchSession("2026-01-19", 85),
    ];
    const rows = buildExerciseProgressRows({
      sessions,
      definitions: DEFINITIONS,
      start: "2026-01-12",
      end: "2026-01-19",
      previousStart: "2026-01-05",
      previousEnd: "2026-01-11",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].bestWeightKg).toBe(85);
    expect(rows[0].previousBestKg).toBe(80);
    expect(rows[0].deltaKg).toBe(5);
    expect(rows[0].trend.map((point) => point.weightKg)).toEqual([82.5, 85]);
  });

  it("makes all-time lift-board ranges start at the first session", () => {
    const sessions = [
      benchSession("2026-01-05", 80),
      benchSession("2026-01-19", 85),
    ];
    const bounds = liftBoardBounds("all", "2026-01-19", sessions);
    expect(bounds.start).toBe("2026-01-05");
    expect(bounds.end).toBe("2026-01-19");
    expect(bounds.previousStart).toBeNull();
  });
});

describe("recap", () => {
  it("groups PRs by lift and hides estimated 1RM", () => {
    const sessions = [
      benchSession("2026-01-05", 80),
      benchSession("2026-01-12", 85),
    ];
    const records = buildPersonalRecords(sessions);
    const prs = records.map((record) => ({
      metric: record.metric,
      label: record.exerciseName,
      value: record.value,
      unit: record.unit,
      previousValue: record.previousValue,
      exerciseId: record.exerciseId,
      exerciseName: record.exerciseName,
      date: record.scheduledDate,
      scopeKey: record.scopeKey,
      weightKg: record.weightKg,
      reps: record.reps,
    }));
    const groups = groupRecapPrs(prs);
    expect(groups.length).toBeGreaterThan(0);
    expect(
      groups.every((group) =>
        group.metrics.every((pr) => pr.metric !== "estimated1RM"),
      ),
    ).toBe(true);
    expect(
      groups.find((group) => group.exerciseId === "ex_bench")?.exerciseName,
    ).toBe("Bench Press");
  });

  it("builds a weekly recap with consistency, muscle balance, and a focus", () => {
    const sessions = [
      benchSession("2026-01-05", 80),
      benchSession("2026-01-12", 85),
    ];
    const records = buildPersonalRecords(sessions);
    const recap = buildRecap({
      sessions,
      records,
      measurements: MEASUREMENTS,
      definitions: DEFINITIONS,
      schedule: SCHEDULE,
      profile: PROFILE,
      today: "2026-01-12",
      range: "week",
    });
    expect(recap.sessions).toBe(1);
    expect(recap.sets).toBe(1);
    expect(recap.topLifts[0].bestWeightKg).toBe(85);
    expect(recap.plannedSessions).toBe(1);
    expect(recap.muscleBalance.find((row) => row.category === "push")?.sets).toBe(
      1,
    );
    expect(recap.focus.length).toBeGreaterThan(0);
    expect(formatRecapText(recap)).not.toContain("1RM");
  });

  it("builds a post-workout session recap from the saved summary", () => {
    const previous = benchSession("2026-01-05", 80);
    const session = benchSession("2026-01-12", 85);
    session.summary = {
      durationSeconds: 1800,
      exercisesPlanned: 1,
      exercisesCompleted: 1,
      setsCompleted: 1,
      setsSkipped: 0,
      totalReps: 8,
      totalVolumeKg: 680,
      volumeIncludedSets: 1,
      volumeExcludedSets: 0,
      prs: [
        {
          metric: "maxWeight",
          label: "Heaviest set",
          value: 85,
          unit: "kg",
          previousValue: 80,
          exerciseId: "ex_bench",
          exerciseName: "Bench Press",
          scopeKey: "total",
        },
      ],
      isCardio: false,
    };
    const recap = buildSessionRecap({
      session,
      previousSession: previous,
      definitions: DEFINITIONS,
      profile: PROFILE,
      measurements: MEASUREMENTS,
    });
    expect(recap.scope).toBe("session");
    expect(recap.topLifts[0].bestWeightKg).toBe(85);
    expect(recap.prGroups).toHaveLength(1);
    expect(recap.comparison.volumePct).toBeGreaterThan(0);
  });

  it("counts completed sets by muscle group", () => {
    const session = makeSession({
      scheduledDate: "2026-01-12",
      exercises: [
        makeExercise({
          exerciseId: "ex_bench",
          sets: [
            makeSet({ weightKg: 80, reps: 8 }),
            makeSet({ weightKg: 80, reps: 8 }),
          ],
        }),
        makeExercise({
          exerciseId: "ex_row",
          sets: [makeSet({ weightKg: 60, reps: 8 })],
        }),
      ],
    });
    const balance = buildMuscleBalance({
      sessions: [session],
      definitions: DEFINITIONS,
      start: "2026-01-12",
      end: "2026-01-12",
    });
    expect(balance.find((row) => row.category === "push")?.sets).toBe(2);
    expect(balance.find((row) => row.category === "pull")?.sets).toBe(1);
    expect(balance.find((row) => row.category === "legs")?.sets).toBe(0);
  });
});
