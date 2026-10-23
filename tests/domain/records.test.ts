import { describe, expect, it } from "vitest";
import {
  buildPersonalRecords,
  estimatedOneRepMax,
  findNewPrsForSession,
  recordCandidatesForSession,
} from "@/domain/records";
import { makeExercise, makeSession, makeSet } from "../test-factories";

describe("estimated one-rep max", () => {
  it("uses the Epley estimate for 1–12 reps", () => {
    expect(estimatedOneRepMax(100, 1)).toBe(103.33);
    expect(estimatedOneRepMax(100, 8)).toBe(126.67);
  });

  it("refuses invalid weights, reps above 12, and non-finite values", () => {
    expect(estimatedOneRepMax(100, 0)).toBeNull();
    expect(estimatedOneRepMax(100, 13)).toBeNull();
    expect(estimatedOneRepMax(0, 5)).toBeNull();
    expect(estimatedOneRepMax(-10, 5)).toBeNull();
    expect(estimatedOneRepMax(Number.NaN, 5)).toBeNull();
  });
});

describe("personal records", () => {
  it("derives records only from completed sessions", () => {
    const active = makeSession({
      status: "active",
      exercises: [
        makeExercise({
          sets: [makeSet({ weightKg: 200, reps: 10 })],
        }),
      ],
    });
    expect(recordCandidatesForSession(active)).toEqual([]);
    expect(buildPersonalRecords([active])).toEqual([]);
  });

  it("selects the heaviest set and records previous values", () => {
    const first = makeSession({
      id: "first",
      scheduledDate: "2026-01-05",
      exercises: [
        makeExercise({
          exerciseId: "ex_bench",
          name: "Bench Press",
          sets: [makeSet({ weightKg: 100, reps: 5 })],
        }),
      ],
    });
    const second = makeSession({
      id: "second",
      scheduledDate: "2026-01-12",
      exercises: [
        makeExercise({
          exerciseId: "ex_bench",
          name: "Bench Press",
          sets: [makeSet({ weightKg: 110, reps: 5 })],
        }),
      ],
    });
    const records = buildPersonalRecords([first, second]);
    const maxWeight = records.find(
      (record) =>
        record.exerciseId === "ex_bench" && record.metric === "maxWeight",
    );
    expect(maxWeight?.value).toBe(110);
    expect(maxWeight?.previousValue).toBe(100);
    expect(maxWeight?.unit).toBe("kg");
  });

  it("selects the heaviest set before derived estimates", () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          sets: [
            makeSet({ weightKg: 100, reps: 10 }),
            makeSet({ weightKg: 120, reps: 1 }),
          ],
        }),
      ],
    });
    const records = buildPersonalRecords([session]);
    const max = records.find((record) => record.metric === "maxWeight");
    const e1rm = records.find((record) => record.metric === "estimated1RM");
    expect(max?.value).toBe(120);
    expect(e1rm?.value).toBe(133.33);
  });

  it("tracks reps at each weight independently", () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          sets: [
            makeSet({ weightKg: 100, reps: 5 }),
            makeSet({ weightKg: 100, reps: 8 }),
            makeSet({ weightKg: 80, reps: 12 }),
          ],
        }),
      ],
    });
    const records = buildPersonalRecords([session]).filter(
      (record) => record.metric === "repsAtWeight",
    );
    expect(records).toHaveLength(2);
    expect(records.find((record) => record.weightKg === 100)?.value).toBe(8);
    expect(records.find((record) => record.weightKg === 80)?.value).toBe(12);
  });

  it("ignores skipped and incomplete sets in volume and PRs", () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          sets: [
            makeSet({ weightKg: 100, reps: 8 }),
            makeSet({ weightKg: 300, reps: 10, status: "skipped" }),
            makeSet({ weightKg: 200, reps: 20, status: "pending" }),
          ],
        }),
      ],
    });
    const records = buildPersonalRecords([session]);
    const max = records.find((record) => record.metric === "maxWeight");
    expect(max?.value).toBe(100);
    expect(
      records.find((record) => record.metric === "sessionVolume")?.value,
    ).toBe(800);
  });

  it("does not report a PR when the previous best is equal or higher", () => {
    const previous = makeSession({
      exercises: [
        makeExercise({
          exerciseId: "ex_bench",
          sets: [makeSet({ weightKg: 100, reps: 8 })],
        }),
      ],
    });
    const equal = makeSession({
      exercises: [
        makeExercise({
          exerciseId: "ex_bench",
          sets: [makeSet({ weightKg: 100, reps: 8 })],
        }),
      ],
    });
    const lower = makeSession({
      exercises: [
        makeExercise({
          exerciseId: "ex_bench",
          sets: [makeSet({ weightKg: 90, reps: 8 })],
        }),
      ],
    });
    expect(findNewPrsForSession(equal, [previous])).toEqual([]);
    const lowerPrs = findNewPrsForSession(lower, [previous]);
    expect(lowerPrs.some((pr) => pr.metric === "maxWeight")).toBe(false);
    expect(lowerPrs.some((pr) => pr.metric === "estimated1RM")).toBe(false);
    // A new weight still establishes its own reps-at-weight record; this is
    // real data, not a regression of an existing heavier record.
    expect(lowerPrs.some((pr) => pr.metric === "repsAtWeight")).toBe(true);
  });

  it("reports only metrics that beat the previous record", () => {
    const previous = makeSession({
      exercises: [
        makeExercise({
          exerciseId: "ex_bench",
          sets: [makeSet({ weightKg: 100, reps: 8 })],
        }),
      ],
    });
    const prSession = makeSession({
      exercises: [
        makeExercise({
          exerciseId: "ex_bench",
          sets: [makeSet({ weightKg: 110, reps: 8 })],
        }),
      ],
    });
    const prs = findNewPrsForSession(prSession, [previous]);
    expect(prs.some((pr) => pr.metric === "maxWeight")).toBe(true);
    expect(prs.some((pr) => pr.metric === "estimated1RM")).toBe(true);
    expect(prs.every((pr) => pr.previousValue === null || pr.previousValue >= 0)).toBe(
      true,
    );
  });

  it("keeps target performance out of descriptive-only work", () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          load: {
            kind: "descriptive",
            label: "Full stack + 15 kg",
            numericEquivalentKg: null,
          },
          targetSets: 2,
          targetReps: 8,
          sets: [
            makeSet({
              weightKg: null,
              reps: 10,
              loadDescription: "Full stack + 15 kg",
            }),
            makeSet({
              weightKg: null,
              reps: 10,
              loadDescription: "Full stack + 15 kg",
            }),
          ],
        }),
      ],
    });
    const records = buildPersonalRecords([session]);
    expect(
      records.find((record) => record.metric === "targetPerformance"),
    ).toBeUndefined();
    expect(records.find((record) => record.metric === "maxWeight")).toBeUndefined();
  });
});
