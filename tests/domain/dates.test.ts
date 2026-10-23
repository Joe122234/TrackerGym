import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  addMonthsToKey,
  buildAttendance,
  calculateStreakStats,
  dateKeyInTimeZone,
  diffDateKeys,
  endOfMonthKey,
  endOfWeekKey,
  formatDuration,
  formatDurationLong,
  isValidDateKey,
  isValidTimeZone,
  monthGrid,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
  weekdayForDateKey,
} from "@/domain/dates";
import type { ScheduleEntry, Weekday } from "@/domain/types";
import { makeSession } from "../test-factories";

const schedule: ScheduleEntry[] = [
  { day: "monday", kind: "training", templateId: "push", templateName: "Push" },
  { day: "tuesday", kind: "training", templateId: "pull", templateName: "Pull" },
  { day: "wednesday", kind: "training", templateId: "legs", templateName: "Legs" },
  { day: "thursday", kind: "training", templateId: "cardio", templateName: "Cardio" },
  { day: "friday", kind: "training", templateId: "upper", templateName: "Upper" },
  { day: "saturday", kind: "training", templateId: "legs2", templateName: "Legs" },
  { day: "sunday", kind: "rest", templateId: null, templateName: null },
].map((entry) => ({ ...entry, id: entry.day as Weekday, updatedAt: 0 })) as ScheduleEntry[];

function scheduledSession(date: string, source: "scheduled" | "extra" = "scheduled") {
  return makeSession({ scheduledDate: date, source });
}

describe("date keys and timezones", () => {
  it("validates real calendar dates including leap years", () => {
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("06-01-01")).toBe(false);
  });

  it("resolves Bangkok local dates across a UTC boundary", () => {
    const instant = Date.UTC(2025, 11, 31, 17, 30);
    expect(dateKeyInTimeZone(instant, "Asia/Bangkok")).toBe("2026-01-01");
    expect(dateKeyInTimeZone(instant, "UTC")).toBe("2025-12-31");
    expect(todayKey("Asia/Bangkok", instant)).toBe("2026-01-01");
  });

  it("validates timezone names", () => {
    expect(isValidTimeZone("Asia/Bangkok")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("finds Monday as the start of the training week", () => {
    expect(weekdayForDateKey("2026-01-05")).toBe("monday");
    expect(startOfWeekKey("2026-01-05")).toBe("2026-01-05");
    expect(startOfWeekKey("2026-01-11")).toBe("2026-01-05");
    expect(endOfWeekKey("2026-01-07")).toBe("2026-01-11");
    expect(addDaysToKey("2026-01-05", -1)).toBe("2026-01-04");
    expect(diffDateKeys("2026-01-05", "2026-01-11")).toBe(6);
  });

  it("creates a six-week Monday-first calendar grid", () => {
    const grid = monthGrid("2026-02-01");
    expect(grid).toHaveLength(42);
    expect(weekdayForDateKey(grid[0])).toBe("monday");
    expect(grid[0]).toBe("2026-01-26");
    expect(grid[41]).toBe("2026-03-08");
  });

  it("handles month boundaries without losing the current year", () => {
    expect(startOfMonthKey("2026-12-19")).toBe("2026-12-01");
    expect(endOfMonthKey("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonthKey("2024-02-10")).toBe("2024-02-29");
    expect(addMonthsToKey("2026-01-15", -1)).toBe("2025-12-01");
    expect(addMonthsToKey("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("formats elapsed durations consistently", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDurationLong(3661)).toBe("1h 1m");
    expect(formatDurationLong(59)).toBe("1m");
  });
});

describe("attendance and streaks", () => {
  it("marks rest days as exempt and future training days as upcoming", () => {
    const days = buildAttendance(
      "2026-01-04",
      "2026-01-06",
      "2026-01-05",
      schedule,
      [],
    );
    expect(days.map((day) => day.status)).toEqual(["rest", "today", "upcoming"]);
  });

  it("awards a completed day only from a saved scheduled session", () => {
    const days = buildAttendance(
      "2026-01-05",
      "2026-01-05",
      "2026-01-05",
      schedule,
      [scheduledSession("2026-01-05")],
    );
    expect(days[0].status).toBe("completed");
    expect(days[0].sessionIds).toHaveLength(1);
  });

  it("treats an extra-only day as a missed scheduled day but records the extra", () => {
    const days = buildAttendance(
      "2026-01-05",
      "2026-01-05",
      "2026-01-06",
      schedule,
      [scheduledSession("2026-01-05", "extra")],
    );
    expect(days[0].status).toBe("missed");
    expect(days[0].hasExtraSession).toBe(true);
  });

  it("keeps rest days exempt while counting the current streak", () => {
    const sessions = [
      scheduledSession("2026-01-05"),
      scheduledSession("2026-01-06"),
      scheduledSession("2026-01-07"),
    ];
    const days = buildAttendance(
      "2026-01-04",
      "2026-01-11",
      "2026-01-08",
      schedule,
      sessions,
    );
    const stats = calculateStreakStats(days, "2026-01-08", "2026-01-05");
    expect(stats.current).toBe(3);
    expect(stats.longest).toBe(3);
    expect(stats.totalCompleted).toBe(3);
    expect(stats.completedThisWeek).toBe(3);
    expect(stats.plannedThisWeek).toBe(6);
    expect(stats.dueThisWeek).toBe(3);
    expect(stats.weeklyConsistency).toBe(100);
    expect(stats.extraSessionsThisWeek).toBe(0);
  });

  it("does not let an unfinished today break the previous streak", () => {
    const days = buildAttendance(
      "2026-01-05",
      "2026-01-06",
      "2026-01-06",
      schedule,
      [scheduledSession("2026-01-05")],
    );
    const stats = calculateStreakStats(days, "2026-01-06", "2026-01-05");
    expect(stats.current).toBe(1);
    expect(stats.dueThisWeek).toBe(1);
  });

  it("breaks the streak on a missed past training day", () => {
    const days = buildAttendance(
      "2026-01-05",
      "2026-01-07",
      "2026-01-08",
      schedule,
      [scheduledSession("2026-01-05"), scheduledSession("2026-01-07")],
    );
    const stats = calculateStreakStats(days, "2026-01-08", "2026-01-05");
    expect(stats.current).toBe(1);
    expect(stats.longest).toBe(1);
    expect(stats.totalCompleted).toBe(2);
    expect(stats.weeklyConsistency).toBe(67);
  });

  it("keeps rest days from lowering weekly consistency", () => {
    const days = buildAttendance(
      "2026-01-05",
      "2026-01-11",
      "2026-01-11",
      schedule,
      [scheduledSession("2026-01-10")],
    );
    const stats = calculateStreakStats(days, "2026-01-11", "2026-01-05");
    expect(stats.plannedThisWeek).toBe(6);
    expect(stats.dueThisWeek).toBe(6);
    expect(stats.weeklyConsistency).toBe(17);
  });

  it("returns a null weekly consistency before any day is due", () => {
    const days = buildAttendance(
      "2026-01-05",
      "2026-01-05",
      "2026-01-05",
      schedule,
      [],
    );
    // Monday is due only when completed; an incomplete today is not counted.
    const stats = calculateStreakStats(days, "2026-01-05", "2026-01-05");
    expect(stats.dueThisWeek).toBe(0);
    expect(stats.weeklyConsistency).toBeNull();
  });

  it("counts extra sessions separately without treating them as scheduled", () => {
    const days = buildAttendance(
      "2026-01-05",
      "2026-01-11",
      "2026-01-08",
      schedule,
      [scheduledSession("2026-01-05"), scheduledSession("2026-01-05", "extra")],
    );
    const stats = calculateStreakStats(days, "2026-01-08", "2026-01-05");
    expect(stats.extraSessionsThisWeek).toBe(1);
    expect(stats.completedThisWeek).toBe(1);
  });
});
