import {
  collection,
  deleteDoc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type {
  ExerciseDefinition,
  ScheduleEntry,
  SessionSource,
  WorkoutSession,
  WorkoutTemplate,
} from "@/domain/types";
import { dateKeyInTimeZone, weekdayForDateKey } from "@/domain/dates";
import { findNewPrsForSession } from "@/domain/records";
import {
  createWorkoutSession,
  getSessionSetCounts,
  summarizeSession,
} from "@/domain/workout";
import { workoutSessionSchema } from "@/domain/schemas";
import { requireFirebaseClient } from "./client";
import {
  activeSessionRef,
  sessionRef,
} from "./paths";

function parseSession(data: unknown, path: string): WorkoutSession {
  const parsed = workoutSessionSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Workout data at ${path} is invalid and was not loaded.`);
  }
  return parsed.data;
}

export async function fetchCompletedSessions(
  uid: string,
): Promise<WorkoutSession[]> {
  const { db } = requireFirebaseClient();
  const snapshot = await getDocs(
    query(
      collection(db, "users", uid, "workoutSessions"),
      where("status", "==", "completed"),
      orderBy("startedAt", "desc"),
    ),
  );
  return snapshot.docs.map((document) =>
    parseSession(document.data(), document.ref.path),
  );
}

export async function fetchActiveSession(
  uid: string,
): Promise<WorkoutSession | null> {
  const { db } = requireFirebaseClient();
  const snapshot = await getDoc(activeSessionRef(db, uid));
  if (!snapshot.exists()) return null;
  return parseSession(snapshot.data(), snapshot.ref.path);
}

export function resolveSessionSource(
  templateId: string,
  timezone: string,
  schedule: ScheduleEntry[],
  sessions: WorkoutSession[],
  now = Date.now(),
): SessionSource {
  const date = dateKeyInTimeZone(now, timezone);
  const day = weekdayForDateKey(date);
  const scheduleEntry = schedule.find((entry) => entry.day === day);
  const alreadyCompleted = sessions.some(
    (session) =>
      session.status === "completed" &&
      session.source === "scheduled" &&
      session.scheduledDate === date,
  );
  if (
    scheduleEntry?.kind === "training" &&
    scheduleEntry.templateId === templateId &&
    !alreadyCompleted
  ) {
    return "scheduled";
  }
  return "extra";
}

export async function startActiveSession(input: {
  uid: string;
  template: WorkoutTemplate;
  definitions: ExerciseDefinition[];
  schedule: ScheduleEntry[];
  sessions: WorkoutSession[];
  timezone: string;
  now?: number;
}): Promise<WorkoutSession> {
  const { db } = requireFirebaseClient();
  const activeSnap = await getDoc(activeSessionRef(db, input.uid));
  if (activeSnap.exists()) {
    return parseSession(activeSnap.data(), activeSnap.ref.path);
  }
  const now = input.now ?? Date.now();
  const source = resolveSessionSource(
    input.template.id,
    input.timezone,
    input.schedule,
    input.sessions,
    now,
  );
  const session = createWorkoutSession({
    template: input.template,
    definitions: input.definitions,
    source,
    timezone: input.timezone,
    now,
  });
  const parsed = workoutSessionSchema.safeParse(session);
  if (!parsed.success) throw new Error("The new workout could not be created.");
  await setDoc(activeSessionRef(db, input.uid), parsed.data);
  return parsed.data;
}

export async function saveActiveSession(
  uid: string,
  session: WorkoutSession,
): Promise<void> {
  if (session.status !== "active") {
    throw new Error("Only an active workout can be autosaved here.");
  }
  const { db } = requireFirebaseClient();
  const parsed = workoutSessionSchema.safeParse(session);
  if (!parsed.success) throw new Error("The workout draft is not valid.");
  await setDoc(activeSessionRef(db, uid), parsed.data);
}

export async function discardActiveSession(uid: string): Promise<void> {
  const { db } = requireFirebaseClient();
  await deleteDoc(activeSessionRef(db, uid));
}

export async function finalizeActiveSession(input: {
  uid: string;
  session: WorkoutSession;
  previousSessions: WorkoutSession[];
  now?: number;
}): Promise<WorkoutSession> {
  const { db } = requireFirebaseClient();
  const now = input.now ?? Date.now();
  const completed: WorkoutSession = {
    ...input.session,
    status: "completed",
    completedAt: now,
    updatedAt: now,
    revision: input.session.revision + 1,
    summary: null,
  };
  const prs =
    completed.workoutType === "strength"
      ? findNewPrsForSession(completed, input.previousSessions)
      : [];
  completed.summary = summarizeSession(completed, prs, now);
  const parsed = workoutSessionSchema.safeParse(completed);
  if (!parsed.success) throw new Error("The completed workout is not valid.");

  const batch = writeBatch(db);
  batch.set(sessionRef(db, input.uid, completed.id), parsed.data);
  batch.delete(activeSessionRef(db, input.uid));
  await batch.commit();
  return parsed.data;
}

export async function updateCompletedSession(input: {
  uid: string;
  session: WorkoutSession;
  allSessions: WorkoutSession[];
  now?: number;
}): Promise<WorkoutSession> {
  const { db } = requireFirebaseClient();
  const now = input.now ?? Date.now();
  const previous = input.allSessions
    .filter(
      (session) =>
        session.id !== input.session.id &&
        session.status === "completed" &&
        (session.completedAt ?? session.startedAt) <=
          (input.session.completedAt ?? input.session.startedAt),
    )
    .sort(
      (a, b) =>
        (a.completedAt ?? a.startedAt) - (b.completedAt ?? b.startedAt),
    );
  const prs =
    input.session.workoutType === "strength"
      ? findNewPrsForSession(
          { ...input.session, status: "completed" },
          previous,
        )
      : [];
  const updated: WorkoutSession = {
    ...input.session,
    status: "completed",
    updatedAt: now,
    revision: input.session.revision + 1,
    summary: summarizeSession(input.session, prs, now),
  };
  const parsed = workoutSessionSchema.safeParse(updated);
  if (!parsed.success) throw new Error("The workout edits are not valid.");
  await setDoc(sessionRef(db, input.uid, updated.id), parsed.data);
  return parsed.data;
}

export async function deleteCompletedSession(
  uid: string,
  sessionId: string,
): Promise<void> {
  const { db } = requireFirebaseClient();
  const snapshot = await getDocs(
    query(
      collection(db, "users", uid, "workoutSessions"),
      where("status", "==", "completed"),
      orderBy("startedAt", "asc"),
    ),
  );
  const remaining = snapshot.docs
    .map((document) => parseSession(document.data(), document.ref.path))
    .filter((session) => session.id !== sessionId)
    .sort(
      (a, b) =>
        (a.completedAt ?? a.startedAt) - (b.completedAt ?? b.startedAt),
    );

  // Deleting a session can invalidate the historical PR marks of later
  // sessions. Rebuild every remaining summary from the authoritative order so
  // no cached PR survives the deletion incorrectly.
  const batch = writeBatch(db);
  batch.delete(sessionRef(db, uid, sessionId));
  const previous: WorkoutSession[] = [];
  const now = Date.now();
  for (const session of remaining) {
    const prs =
      session.workoutType === "strength"
        ? findNewPrsForSession(session, previous)
        : [];
    const updated: WorkoutSession = {
      ...session,
      summary: summarizeSession(session, prs, now),
      revision: session.revision + 1,
      updatedAt: now,
    };
    const parsed = workoutSessionSchema.safeParse(updated);
    if (!parsed.success) {
      throw new Error("A remaining workout summary could not be rebuilt.");
    }
    batch.set(sessionRef(db, uid, updated.id), parsed.data);
    previous.push(updated);
  }
  await batch.commit();
}

export async function fetchAllSessionsForExport(
  uid: string,
): Promise<WorkoutSession[]> {
  const [completed, active] = await Promise.all([
    fetchCompletedSessions(uid),
    fetchActiveSession(uid),
  ]);
  return active ? [active, ...completed] : completed;
}

export function workoutSetProgress(session: WorkoutSession): number {
  const counts = getSessionSetCounts(session);
  if (counts.total === 0) return 0;
  return Math.round((counts.completed / counts.total) * 100);
}

export { parseSession };
