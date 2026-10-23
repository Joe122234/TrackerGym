import { describe, expect, it } from "vitest";
import { getProgressionRecommendation } from "@/domain/progression";
import { makeExercise, makeSession, makeSet } from "../test-factories";

function recommendation(
  sessions: ReturnType<typeof makeSession>[],
  overrides: Partial<Parameters<typeof getProgressionRecommendation>[0]> = {},
) {
  return getProgressionRecommendation({
    exerciseId: "ex_bench",
    exerciseName: "Bench Press",
    sessions,
    defaultLoad: { kind: "numeric", kg: 100, basis: "total" },
    targetSets: 3,
    targetReps: 8,
    incrementKg: 2.5,
    unit: "kg",
    ...overrides,
  });
}

function benchSession(
  weights: number[],
  reps: number[],
  statuses: Array<"completed" | "skipped" | "pending"> = [],
) {
  return makeSession({
    exercises: [
      makeExercise({
        exerciseId: "ex_bench",
        name: "Bench Press",
        targetSets: 3,
        targetReps: 8,
        sets: weights.map((weightKg, index) =>
          makeSet({
            weightKg,
            reps: reps[index],
            status: statuses[index] ?? "completed",
            order: index,
          }),
        ),
      }),
    ],
  });
}

describe("progression recommendations", () => {
  it("asks for a baseline when there is no history", () => {
    const result = recommendation([]);
    expect(result.kind).toBe("insufficient");
    expect(result.suggestedWeightKg).toBeNull();
    expect(result.sessionsConsidered).toBe(0);
  });

  it("suggests an increase only after all target sets and reps are met", () => {
    const result = recommendation([benchSession([100, 100, 100], [8, 8, 8])]);
    expect(result.kind).toBe("increase");
    expect(result.targetAchieved).toBe(true);
    expect(result.suggestedWeightKg).toBe(102.5);
    expect(result.sessionsConsidered).toBe(1);
  });

  it("holds the load when a target set falls short", () => {
    const result = recommendation([benchSession([100, 100, 100], [8, 7, 8])]);
    expect(result.kind).toBe("maintain");
    expect(result.suggestedWeightKg).toBe(100);
    expect(result.targetAchieved).toBe(false);
  });

  it("does not recommend an increase when a target set is skipped", () => {
    const result = recommendation([
      benchSession([100, 100, 100], [8, 8, 8], ["completed", "skipped", "completed"]),
    ]);
    expect(result.kind).toBe("maintain");
  });

  it("never invents a numeric load for a descriptive exercise", () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          exerciseId: "ex_bench",
          load: {
            kind: "descriptive",
            label: "Full stack + 15 kg",
            numericEquivalentKg: null,
          },
          sets: [
            makeSet({
              weightKg: null,
              reps: 10,
              loadDescription: "Full stack + 15 kg",
            }),
          ],
        }),
      ],
    });
    const result = recommendation([session]);
    expect(result.kind).toBe("manual");
    expect(result.suggestedWeightKg).toBeNull();
    expect(result.detail).toContain("will not invent");
  });

  it("handles descriptive default prescriptions without history", () => {
    const result = recommendation([], {
      defaultLoad: {
        kind: "descriptive",
        label: "Full stack + 20 kg",
        numericEquivalentKg: null,
      },
    });
    expect(result.kind).toBe("insufficient");
    expect(result.suggestedWeightKg).toBeNull();
  });

  it("flags wide load variation instead of guessing", () => {
    const previous = benchSession([90, 90, 90], [8, 8, 8]);
    const latest = benchSession([120, 120, 120], [8, 7, 8]);
    const result = recommendation([latest, previous]);
    expect(result.kind).toBe("inconsistent");
    expect(result.suggestedWeightKg).toBeNull();
  });

  it("returns achieved without a suggestion when no increment is configured", () => {
    const result = recommendation([benchSession([100, 100, 100], [8, 8, 8])], {
      incrementKg: null,
    });
    expect(result.kind).toBe("achieved");
    expect(result.suggestedWeightKg).toBeNull();
  });

  it("uses real display units in the recommendation detail", () => {
    const result = recommendation([benchSession([100, 100, 100], [8, 8, 8])], {
      unit: "lb",
    });
    expect(result.kind).toBe("increase");
    expect(result.detail).toContain("lb");
  });
});
