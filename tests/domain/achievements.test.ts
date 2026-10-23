import { describe, expect, it } from "vitest";
import type { Achievement, ScheduleEntry, Weekday } from "@/domain/types";
import { buildAttendance, calculateStreakStats, startOfWeekKey } from "@/domain/dates";
import { computeAchievements, unseenAchievements } from "@/domain/achievements";
import { makeExercise, makeSession, makeSet } from "../test-factories";

const schedule: ScheduleEntry[] = [
  { day: "monday", kind: "training", templateId: "push", templateName: "Push" },
  { day: "tuesday", kind: "training", templateId: "pull", templateName: "Pull" },
  { day: "wednesday", kind: "training", templateId: "legs", templateName: "Legs" },
  { day: "thursday", kind: "training", templateId: "cardio", templateName: "Cardio" },
  { day: "friday", kind: "training", templateId: "upper", templateName: "Upper" },
  { day: "saturday", kind: "training", templateId: "legs2", templateName: "Legs" },
  { day: "sunday", kind: "rest", templateId: null, templateName: null },
].map((entry) => ({ ...entry, id: entry.day as Weekday, updatedAt: 0 })) as ScheduleEntry[];

function completedOn(date: string, id: string, weight = 100) {
  return makeSession({
    id,
    scheduledDate: date,
    completedAt: Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      12,
    ),
    exercises: [
      makeExercise({
        exerciseId: "ex_bench",
        name: "Bench Press",
        sets: [makeSet({ weightKg: weight, reps: 8 })],
      }),
    ],
  });
}

function achievementsFor(
  sessions: ReturnType<typeof makeSession>[],
  start: string,
  today: string,
  existing: Achievement[] = [],
) {
  const attendance = buildAttendance(start, today, today, schedule, sessions);
  const streak = calculateStreakStats(attendance, today, startOfWeekKey(today));
  return computeAchievements({
    sessions,
    attendance,
    streakStats: streak,
    today,
    existing,
    now: Date.UTC(2026, 0, 31, 12),
  });
}

describe("achievements", () => {
  it("does not award anything for planned or completed-less history", () => {
    expect(achievementsFor([], "2026-01-05", "2026-01-11")).toEqual([]);
  });

  it("awards the first workout from a completed session", () => {
    const achievements = achievementsFor(
      [completedOn("2026-01-05", "s1")],
      "2026-01-05",
      "2026-01-06",
    );
    const first = achievements.find(
      (achievement) => achievement.key === "first_workout",
    );
    expect(first).toBeDefined();
    expect(first?.category).toBe("workout");
    expect(
      achievements.find((achievement) => achievement.key === "first_record"),
    ).toBeDefined();
  });

  it("awards full-week consistency only after the week has ended", () => {
    const sessions = [
      completedOn("2026-01-05", "s1"),
      completedOn("2026-01-06", "s2"),
      completedOn("2026-01-07", "s3"),
      completedOn("2026-01-08", "s4"),
      completedOn("2026-01-09", "s5"),
      completedOn("2026-01-10", "s6"),
    ];
    const during = achievementsFor(sessions, "2026-01-05", "2026-01-11");
    expect(during.some((item) => item.key === "first_full_week")).toBe(false);
    const after = achievementsFor(sessions, "2026-01-05", "2026-01-12");
    expect(after.some((item) => item.key === "first_full_week")).toBe(true);
  });

  it("counts streak thresholds across rest days but not missed days", () => {
    const sessions = [
      completedOn("2026-01-05", "s1"),
      completedOn("2026-01-06", "s2"),
      completedOn("2026-01-07", "s3"),
    ];
    const achievements = achievementsFor(sessions, "2026-01-05", "2026-01-08");
    expect(achievements.some((item) => item.key === "streak_3")).toBe(true);
    expect(achievements.some((item) => item.key === "streak_7")).toBe(false);
  });

  it("preserves a seen timestamp across recomputation", () => {
    const sessions = [completedOn("2026-01-05", "s1")];
    const first = achievementsFor(sessions, "2026-01-05", "2026-01-06");
    const target = first[0];
    const seen = first.map((achievement) =>
      achievement.key === target.key
        ? { ...achievement, seenAt: 1_767_700_000_000 }
        : achievement,
    );
    const second = achievementsFor(
      sessions,
      "2026-01-05",
      "2026-01-06",
      seen,
    );
    expect(
      second.find((achievement) => achievement.key === target.key)?.seenAt,
    ).toBe(1_767_700_000_000);
    expect(unseenAchievements(second).length).toBe(second.length - 1);
  });

  it("awards ten-workout milestones from real sessions", () => {
    const sessions = Array.from({ length: 10 }, (_, index) =>
      completedOn(`2026-01-${String(index + 1).padStart(2, "0")}`, `s${index}`),
    );
    const achievements = achievementsFor(sessions, "2026-01-01", "2026-01-12");
    expect(achievements.some((item) => item.key === "workouts_10")).toBe(true);
  });

  it("awards an exercise progression milestone on a heavier working set", () => {
    const first = completedOn("2026-01-05", "s1", 100);
    const second = completedOn("2026-01-06", "s2", 110);
    const achievements = achievementsFor([first, second], "2026-01-05", "2026-01-07");
    expect(
      achievements.some((item) => item.key.startsWith("exercise_progress_")),
    ).toBe(true);
  });
});
