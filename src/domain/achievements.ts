import type {
  Achievement,
  AttendanceDay,
  WorkoutSession,
} from "./types";
import type { StreakStats } from "./dates";
import { addDaysToKey, startOfMonthKey, startOfWeekKey } from "./dates";

interface AchievementSeed {
  key: string;
  title: string;
  description: string;
  category: Achievement["category"];
  earnedAt: number;
  metadata?: Record<string, string | number | null>;
}

function earliestCompleted(sessions: WorkoutSession[]): number | null {
  const completed = sessions
    .filter((session) => session.status === "completed")
    .map((session) => session.completedAt ?? session.startedAt)
    .sort((a, b) => a - b);
  return completed[0] ?? null;
}

function sessionsOnDate(
  sessions: WorkoutSession[],
  date: string,
): WorkoutSession[] {
  return sessions.filter(
    (session) =>
      session.status === "completed" && session.scheduledDate === date,
  );
}

function streakEarnedAt(
  attendance: AttendanceDay[],
  sessions: WorkoutSession[],
  threshold: number,
): number | null {
  let running = 0;
  for (const day of attendance) {
    if (day.kind === "rest") continue;
    if (day.status === "completed") {
      running += 1;
      if (running >= threshold) {
        const matching = sessionsOnDate(sessions, day.date);
        const timestamps = matching
          .map((session) => session.completedAt ?? session.startedAt)
          .sort((a, b) => a - b);
        if (timestamps.length > 0) return timestamps[0];
      }
    } else if (day.status === "missed") {
      running = 0;
    }
  }
  return null;
}

function weekCompletion(
  attendance: AttendanceDay[],
  sessions: WorkoutSession[],
  today: string,
): AchievementSeed | null {
  const weeks = new Map<string, AttendanceDay[]>();
  for (const day of attendance) {
    const start = startOfWeekKey(day.date);
    const bucket = weeks.get(start) ?? [];
    bucket.push(day);
    weeks.set(start, bucket);
  }

  const candidates: Array<{ start: string; earnedAt: number }> = [];
  for (const [start, days] of weeks.entries()) {
    if (addDaysToKey(start, 6) >= today) continue;
    const training = days.filter((day) => day.kind === "training");
    if (training.length === 0) continue;
    if (training.every((day) => day.status === "completed")) {
      const timestamps = training.flatMap((day) =>
        sessionsOnDate(sessions, day.date).map(
          (session) => session.completedAt ?? session.startedAt,
        ),
      );
      if (timestamps.length > 0) {
        candidates.push({
          start,
          earnedAt: Math.max(...timestamps),
        });
      }
    }
  }

  candidates.sort((a, b) => a.earnedAt - b.earnedAt);
  if (candidates.length === 0) return null;
  return {
    key: "first_full_week",
    title: "Full week forged",
    description: "Completed every scheduled training day in a full week.",
    category: "consistency",
    earnedAt: candidates[0].earnedAt,
    metadata: { weekStart: candidates[0].start },
  };
}

function monthCompletion(
  attendance: AttendanceDay[],
  sessions: WorkoutSession[],
  today: string,
): AchievementSeed | null {
  const months = new Map<string, AttendanceDay[]>();
  for (const day of attendance) {
    const month = startOfMonthKey(day.date);
    const bucket = months.get(month) ?? [];
    bucket.push(day);
    months.set(month, bucket);
  }

  const candidates: number[] = [];
  for (const [month, days] of months.entries()) {
    const nextMonth = addDaysToKey(startOfMonthKey(month), 32);
    const monthEnd = addDaysToKey(startOfMonthKey(nextMonth), -1);
    if (monthEnd >= today) continue;
    const training = days.filter((day) => day.kind === "training");
    if (training.length === 0) continue;
    if (training.every((day) => day.status === "completed")) {
      const timestamps = training.flatMap((day) =>
        sessionsOnDate(sessions, day.date).map(
          (session) => session.completedAt ?? session.startedAt,
        ),
      );
      if (timestamps.length > 0) candidates.push(Math.max(...timestamps));
    }
  }

  if (candidates.length === 0) return null;
  return {
    key: "first_full_month",
    title: "A month of consistency",
    description: "Completed every scheduled training day in a calendar month.",
    category: "consistency",
    earnedAt: Math.min(...candidates),
  };
}

function exerciseProgress(
  sessions: WorkoutSession[],
  now: number,
): AchievementSeed[] {
  const chronological = sessions
    .filter((session) => session.status === "completed")
    .sort((a, b) => (a.completedAt ?? a.startedAt) - (b.completedAt ?? b.startedAt));
  const firstMax = new Map<string, number>();
  const firstAchievedAt = new Map<string, number>();
  const firstProgress = new Map<string, { earnedAt: number; name: string }>();
  const sessionCounts = new Map<string, number>();
  const names = new Map<string, string>();

  for (const session of chronological) {
    const timestamp = session.completedAt ?? session.startedAt;
    for (const exercise of session.exercises) {
      const numericSets = exercise.sets.filter(
        (set) =>
          set.status === "completed" &&
          set.weightKg !== null &&
          set.weightKg > 0,
      );
      if (numericSets.length === 0) continue;
      names.set(exercise.exerciseId, exercise.name);
      sessionCounts.set(
        exercise.exerciseId,
        (sessionCounts.get(exercise.exerciseId) ?? 0) + 1,
      );
      const max = Math.max(
        ...numericSets.map((set) => set.weightKg as number),
      );
      if (!firstMax.has(exercise.exerciseId)) {
        firstMax.set(exercise.exerciseId, max);
        firstAchievedAt.set(exercise.exerciseId, timestamp);
      } else if (
        max > (firstMax.get(exercise.exerciseId) as number) &&
        !firstProgress.has(exercise.exerciseId)
      ) {
        firstProgress.set(exercise.exerciseId, {
          earnedAt: timestamp,
          name: exercise.name,
        });
      }
    }
  }

  const achievements: AchievementSeed[] = [];
  for (const [exerciseId, progress] of firstProgress.entries()) {
    achievements.push({
      key: `exercise_progress_${exerciseId}`,
      title: "Strength moving up",
      description: `Increased the working weight for ${progress.name}.`,
      category: "exercise",
      earnedAt: progress.earnedAt,
      metadata: { exerciseId, exerciseName: progress.name },
    });
  }
  for (const [exerciseId, count] of sessionCounts.entries()) {
    if (count >= 10) {
      const name = names.get(exerciseId) ?? "an exercise";
      const chronologicalSessions = chronological.filter((session) =>
        session.exercises.some(
          (exercise) =>
            exercise.exerciseId === exerciseId &&
            exercise.sets.some(
              (set) =>
                set.status === "completed" &&
                set.weightKg !== null &&
                set.weightKg > 0,
            ),
        ),
      );
      const timestamp =
        chronologicalSessions[chronologicalSessions.length - 1]?.completedAt ??
        now;
      achievements.push({
        key: `exercise_ten_sessions_${exerciseId}`,
        title: "Ten sessions strong",
        description: `Logged 10 sessions for ${name}.`,
        category: "exercise",
        earnedAt: timestamp,
        metadata: { exerciseId, exerciseName: name, sessions: count },
      });
    }
  }
  return achievements;
}

export function computeAchievements(input: {
  sessions: WorkoutSession[];
  attendance: AttendanceDay[];
  streakStats: StreakStats;
  today: string;
  existing?: Achievement[];
  now?: number;
}): Achievement[] {
  const {
    sessions,
    attendance,
    today,
    existing = [],
    now = Date.now(),
  } = input;
  const completed = sessions.filter((session) => session.status === "completed");
  const seeds: AchievementSeed[] = [];
  const firstTimestamp = earliestCompleted(completed);

  if (completed.length >= 1 && firstTimestamp !== null) {
    seeds.push({
      key: "first_workout",
      title: "The first rep",
      description: "Completed your first workout in FORGE.",
      category: "workout",
      earnedAt: firstTimestamp,
    });
  }

  const firstNumericSet = completed
    .flatMap((session) =>
      session.exercises.flatMap((exercise) =>
        exercise.sets
          .filter(
            (set) =>
              set.status === "completed" &&
              set.weightKg !== null &&
              set.reps !== null &&
              set.weightKg > 0,
          )
          .map(() => session.completedAt ?? session.startedAt),
      ),
    )
    .sort((a, b) => a - b)[0];
  if (firstNumericSet !== undefined) {
    seeds.push({
      key: "first_record",
      title: "First personal record",
      description: "Set your first automatically detected personal record.",
      category: "record",
      earnedAt: firstNumericSet,
    });
  }

  const fullWeek = weekCompletion(attendance, sessions, today);
  if (fullWeek) seeds.push(fullWeek);
  const fullMonth = monthCompletion(attendance, sessions, today);
  if (fullMonth) seeds.push(fullMonth);

  for (const threshold of [3, 7, 14, 30, 60, 100]) {
    const earnedAt = streakEarnedAt(attendance, sessions, threshold);
    if (earnedAt !== null) {
      seeds.push({
        key: `streak_${threshold}`,
        title:
          threshold >= 30
            ? `${threshold} training days deep`
            : `${threshold} training days strong`,
        description: `Reached a ${threshold}-training-day streak. Rest days are always exempt.`,
        category: "streak",
        earnedAt,
      });
    }
  }

  for (const threshold of [10, 25, 50, 100, 250, 500]) {
    if (completed.length >= threshold) {
      const sorted = [...completed].sort(
        (a, b) =>
          (a.completedAt ?? a.startedAt) - (b.completedAt ?? b.startedAt),
      );
      seeds.push({
        key: `workouts_${threshold}`,
        title: `${threshold} workouts forged`,
        description: `Completed ${threshold} workouts.`,
        category: "workout",
        earnedAt: sorted[threshold - 1].completedAt ?? sorted[threshold - 1].startedAt,
      });
    }
  }

  seeds.push(...exerciseProgress(completed, now));

  const existingMap = new Map(existing.map((achievement) => [achievement.key, achievement]));
  const unique = new Map<string, Achievement>();
  for (const seed of seeds) {
    const previous = existingMap.get(seed.key);
    unique.set(seed.key, {
      id: `ach_${seed.key}`,
      key: seed.key,
      title: seed.title,
      description: seed.description,
      category: seed.category,
      earnedAt: previous?.earnedAt ?? seed.earnedAt,
      seenAt: previous?.seenAt ?? null,
      metadata: seed.metadata ?? previous?.metadata ?? {},
    });
  }

  return [...unique.values()].sort((a, b) => b.earnedAt - a.earnedAt);
}

export function unseenAchievements(achievements: Achievement[]): Achievement[] {
  return achievements.filter((achievement) => achievement.seenAt === null);
}
