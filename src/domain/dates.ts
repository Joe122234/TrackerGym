import { formatInTimeZone } from "date-fns-tz";
import type { AttendanceDay, ScheduleEntry, Weekday, WorkoutSession } from "./types";
import { WEEKDAYS } from "./types";

const WEEKDAY_INDEX: Record<Weekday, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

export const WEEKDAY_ORDER = WEEKDAYS;

export function dateKeyInTimeZone(
  timestamp: number,
  timeZone: string,
): string {
  return formatInTimeZone(new Date(timestamp), timeZone, "yyyy-MM-dd");
}

export function todayKey(timeZone: string, now = Date.now()): string {
  return dateKeyInTimeZone(now, timeZone);
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function dateKeyToUtcDate(key: string): Date {
  if (!isValidDateKey(key)) {
    throw new Error(`Invalid date key: ${key}`);
  }
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function utcDateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function weekdayForDateKey(key: string): Weekday {
  const jsDay = dateKeyToUtcDate(key).getUTCDay();
  return WEEKDAYS[(jsDay + 6) % 7];
}

export function weekdayIndex(day: Weekday): number {
  return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].indexOf(
    day,
  );
}

export function addDaysToKey(key: string, amount: number): string {
  const date = dateKeyToUtcDate(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return utcDateToKey(date);
}

export function diffDateKeys(from: string, to: string): number {
  return Math.round(
    (dateKeyToUtcDate(to).getTime() - dateKeyToUtcDate(from).getTime()) /
      86_400_000,
  );
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function formatDateKey(
  key: string,
  pattern = "EEE, MMM d",
): string {
  return formatInTimeZone(dateKeyToUtcDate(key), "UTC", pattern);
}

export function formatTimestamp(
  timestamp: number,
  timeZone: string,
  pattern = "MMM d, yyyy · h:mm a",
): string {
  return formatInTimeZone(new Date(timestamp), timeZone, pattern);
}

export function startOfWeekKey(key: string): string {
  const day = weekdayForDateKey(key);
  const offset = WEEKDAY_INDEX[day] === 0 ? 6 : WEEKDAY_INDEX[day] - 1;
  return addDaysToKey(key, -offset);
}

export function endOfWeekKey(key: string): string {
  return addDaysToKey(startOfWeekKey(key), 6);
}

export function getWeekDays(key: string): string[] {
  const start = startOfWeekKey(key);
  return Array.from({ length: 7 }, (_, index) => addDaysToKey(start, index));
}

export function startOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${key.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
}

export function addMonthsToKey(key: string, amount: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function monthGrid(key: string): string[] {
  const first = startOfMonthKey(key);
  const firstWeekday = weekdayForDateKey(first);
  const leading = WEEKDAY_INDEX[firstWeekday] === 0 ? 6 : WEEKDAY_INDEX[firstWeekday] - 1;
  const gridStart = addDaysToKey(first, -leading);
  return Array.from({ length: 42 }, (_, index) => addDaysToKey(gridStart, index));
}

export function daysBetweenStartAndToday(start: string, today: string): string[] {
  const length = Math.max(0, diffDateKeys(start, today));
  return Array.from({ length: length + 1 }, (_, index) => addDaysToKey(start, index));
}

export function formatTimeRange(
  startTimestamp: number,
  endTimestamp: number,
  timeZone: string,
): string {
  return `${formatTimestamp(startTimestamp, timeZone, "h:mm a")} – ${formatTimestamp(
    endTimestamp,
    timeZone,
    "h:mm a",
  )}`;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatDurationLong(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getScheduleEntry(
  schedule: ScheduleEntry[],
  day: Weekday,
): ScheduleEntry | undefined {
  return schedule.find((entry) => entry.day === day);
}

export function dayStatusForDate(
  date: string,
  today: string,
  schedule: ScheduleEntry[],
  sessions: WorkoutSession[],
): AttendanceDay {
  const day = weekdayForDateKey(date);
  const scheduleEntry = getScheduleEntry(schedule, day);
  const daySessions = sessions.filter(
    (session) =>
      session.status === "completed" && session.scheduledDate === date,
  );
  const sessionIds = daySessions.map((session) => session.id);
  const scheduledSession = daySessions.find(
    (session) => session.source === "scheduled",
  );
  const hasExtraSession = daySessions.some(
    (session) => session.source === "extra",
  );

  if (scheduleEntry?.kind === "rest") {
    return {
      date,
      day,
      kind: "rest",
      status: "rest",
      hasExtraSession,
      sessionIds,
      templateId: null,
      templateName: null,
    };
  }

  const future = date > today;
  const past = date < today;

  return {
    date,
    day,
    kind: "training",
    status: scheduledSession
      ? "completed"
      : future
        ? "upcoming"
        : past
          ? "missed"
          : "today",
    hasExtraSession,
    sessionIds,
    templateId: scheduleEntry?.templateId ?? null,
    templateName: scheduleEntry?.templateName ?? null,
  };
}

export function buildAttendance(
  startDate: string,
  endDate: string,
  today: string,
  schedule: ScheduleEntry[],
  sessions: WorkoutSession[],
): AttendanceDay[] {
  if (diffDateKeys(startDate, endDate) < 0) return [];
  return daysBetweenStartAndToday(startDate, endDate).map((date) =>
    dayStatusForDate(date, today, schedule, sessions),
  );
}

export interface StreakStats {
  current: number;
  longest: number;
  totalCompleted: number;
  completedThisWeek: number;
  plannedThisWeek: number;
  dueThisWeek: number;
  weeklyConsistency: number | null;
  extraSessionsThisWeek: number;
}

/**
 * Rest days are exempt. Today is pending until it is finalized or the local
 * day ends; an incomplete today never breaks the prior streak.
 */
export function calculateStreakStats(
  attendance: AttendanceDay[],
  today: string,
  weekStart: string,
): StreakStats {
  const sorted = [...attendance].sort((a, b) => a.date.localeCompare(b.date));
  let current = 0;
  let longest = 0;
  let running = 0;
  let totalCompleted = 0;

  for (const day of sorted) {
    if (day.kind === "rest") continue;
    if (day.status === "completed") {
      running += 1;
      longest = Math.max(longest, running);
      if (day.sessionIds.length > 0) totalCompleted += 1;
    } else if (day.status === "missed") {
      running = 0;
    }
  }

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const day = sorted[index];
    if (day.kind === "rest") continue;
    if (day.status === "completed") {
      current += 1;
      continue;
    }
    if (day.status === "today" || day.status === "upcoming") continue;
    if (day.status === "missed") break;
  }

  const weekDays = sorted.filter(
    (day) => day.date >= weekStart && day.date <= addDaysToKey(weekStart, 6),
  );
  const weekTraining = weekDays.filter((day) => day.kind === "training");
  const completedThisWeek = weekTraining.filter(
    (day) => day.status === "completed",
  ).length;
  const due = weekTraining.filter(
    (day) =>
      day.date < today ||
      (day.date === today && day.status === "completed"),
  );
  const extraSessionsThisWeek = weekDays.filter(
    (day) => day.hasExtraSession,
  ).length;
  const dueCompleted = due.filter((day) => day.status === "completed").length;

  return {
    current,
    longest: Math.max(longest, current),
    totalCompleted,
    completedThisWeek,
    plannedThisWeek: weekTraining.length,
    dueThisWeek: due.length,
    weeklyConsistency:
      due.length === 0 ? null : Math.round((dueCompleted / due.length) * 100),
    extraSessionsThisWeek,
  };
}

export function getTimezoneOptions(current: string): string[] {
  const common = [
    "Asia/Bangkok",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Yangon",
    "Asia/Kolkata",
    "Australia/Sydney",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "UTC",
  ];
  return Array.from(new Set([current, ...common].filter(Boolean))).sort();
}
