import { getDocs, updateDoc, writeBatch } from "firebase/firestore";
import type { DocumentData, DocumentReference } from "firebase/firestore";
import type {
  Achievement,
  PersonalRecord,
  Preferences,
  Profile,
  ScheduleEntry,
  WorkoutSession,
} from "@/domain/types";
import { achievementSchema, personalRecordSchema } from "@/domain/schemas";
import { buildAttendance, calculateStreakStats, dateKeyInTimeZone, startOfWeekKey, todayKey } from "@/domain/dates";
import { buildPersonalRecords } from "@/domain/records";
import { computeAchievements } from "@/domain/achievements";
import { requireFirebaseClient } from "./client";
import {
  achievementRef,
  achievementsCollection,
  personalRecordRef,
  personalRecordsCollection,
} from "./paths";

export interface DerivedContext {
  sessions: WorkoutSession[];
  schedule: ScheduleEntry[];
  profile: Profile;
  preferences: Preferences;
  now?: number;
}

export interface DerivedResult {
  personalRecords: PersonalRecord[];
  achievements: Achievement[];
}

/** Rebuilds derived caches from completed sessions, the authoritative source. */
export async function syncDerivedData(
  uid: string,
  context: DerivedContext,
): Promise<DerivedResult> {
  const { db } = requireFirebaseClient();
  const now = context.now ?? Date.now();
  const timezone = context.profile.timezone;
  const today = todayKey(timezone, now);
  const startDate = dateKeyInTimeZone(context.profile.createdAt, timezone);
  const attendance = buildAttendance(
    startDate <= today ? startDate : today,
    today,
    today,
    context.schedule,
    context.sessions,
  );
  const streakStats = calculateStreakStats(
    attendance,
    today,
    startOfWeekKey(today),
  );

  const [recordSnap, achievementSnap] = await Promise.all([
    getDocs(personalRecordsCollection(db, uid)),
    getDocs(achievementsCollection(db, uid)),
  ]);

  const existingAchievements = achievementSnap.docs
    .map((document) => achievementSchema.safeParse(document.data()))
    .filter((result) => result.success)
    .map((result) => result.data);

  const personalRecords = buildPersonalRecords(context.sessions);
  const achievements = computeAchievements({
    sessions: context.sessions,
    attendance,
    streakStats,
    today,
    existing: existingAchievements,
    now,
  });

  const operations: Array<{
    type: "set" | "delete";
    ref: DocumentReference<DocumentData>;
    data?: PersonalRecord | Achievement;
  }> = [];

  const recordIds = new Set(personalRecords.map((record) => record.id));
  for (const document of recordSnap.docs) {
    if (!recordIds.has(document.id)) {
      operations.push({ type: "delete", ref: document.ref });
    }
  }
  for (const record of personalRecords) {
    const parsed = personalRecordSchema.safeParse(record);
    if (!parsed.success) continue;
    operations.push({
      type: "set",
      ref: personalRecordRef(db, uid, record.id) as DocumentReference<DocumentData>,
      data: parsed.data,
    });
  }

  const achievementIds = new Set(
    achievements.map((achievement) => achievement.id),
  );
  for (const document of achievementSnap.docs) {
    if (!achievementIds.has(document.id)) {
      operations.push({ type: "delete", ref: document.ref });
    }
  }
  for (const achievement of achievements) {
    const parsed = achievementSchema.safeParse(achievement);
    if (!parsed.success) continue;
    operations.push({
      type: "set",
      ref: achievementRef(db, uid, achievement.id) as DocumentReference<DocumentData>,
      data: parsed.data,
    });
  }

  for (let index = 0; index < operations.length; index += 400) {
    const chunk = operations.slice(index, index + 400);
    const batch = writeBatch(db);
    for (const operation of chunk) {
      if (operation.type === "delete") {
        batch.delete(operation.ref);
      } else if (operation.data) {
        batch.set(operation.ref, operation.data);
      }
    }
    await batch.commit();
  }

  return { personalRecords, achievements };
}

export async function markAchievementSeen(
  uid: string,
  achievementId: string,
  seenAt = Date.now(),
): Promise<void> {
  const { db } = requireFirebaseClient();
  await updateDoc(achievementRef(db, uid, achievementId), {
    seenAt,
  });
}
