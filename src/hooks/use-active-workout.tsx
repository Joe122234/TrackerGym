"use client";

import * as React from "react";
import { onSnapshot } from "firebase/firestore";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type { RecoveryDraft, WorkoutSession } from "@/domain/types";
import { workoutSessionSchema } from "@/domain/schemas";
import { getFirebaseClient } from "@/lib/firebase/client";
import { activeSessionRef } from "@/lib/firebase/paths";
import { saveActiveSession } from "@/lib/firebase/sessions";
import { useAuth } from "./use-auth";
import { useSessions } from "./use-sessions";

const DRAFT_PREFIX = "forge.activeDraft.v1";
const draftKey = (uid: string) => `${DRAFT_PREFIX}.${uid}`;

export async function saveDraftBackup(
  uid: string,
  session: WorkoutSession,
): Promise<void> {
  try {
    const draft: RecoveryDraft = { session, savedAt: Date.now() };
    await idbSet(draftKey(uid), draft);
  } catch {
    // Local backup is best-effort; Firestore remains the primary draft store.
  }
}

export async function clearDraftBackup(uid: string): Promise<void> {
  try {
    await idbDel(draftKey(uid));
  } catch {
    // Ignore unavailable local storage.
  }
}

export async function loadDraftBackup(
  uid: string,
): Promise<RecoveryDraft | null> {
  try {
    const raw = await idbGet(draftKey(uid));
    if (!raw) return null;
    const draft = raw as RecoveryDraft;
    const parsed = workoutSessionSchema.safeParse(draft.session);
    if (!parsed.success || parsed.data.status !== "active") return null;
    return { session: parsed.data, savedAt: draft.savedAt };
  } catch {
    return null;
  }
}

interface ActiveWorkoutContextValue {
  activeSession: WorkoutSession | null;
  loading: boolean;
  error: string | null;
  recoveryDraft: RecoveryDraft | null;
  restoreDraft: () => Promise<void>;
  discardRecoveryDraft: () => Promise<void>;
  otherTabOpen: boolean;
}

const ActiveWorkoutContext =
  React.createContext<ActiveWorkoutContextValue | null>(null);

export function extendDraftBackup(uid: string, session: WorkoutSession) {
  return saveDraftBackup(uid, session);
}

export function ActiveWorkoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { sessions, loading: sessionsLoading } = useSessions();
  const [activeSession, setActiveSession] = React.useState<WorkoutSession | null>(
    null,
  );
  const [loading, setLoading] = React.useState(Boolean(user));
  const [error, setError] = React.useState<string | null>(null);
  const [recoveryDraft, setRecoveryDraft] = React.useState<RecoveryDraft | null>(
    null,
  );
  const [otherTabOpen, setOtherTabOpen] = React.useState(false);
  const [draftChecked, setDraftChecked] = React.useState(false);
  const [tabId] = React.useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36),
  );

  React.useEffect(() => {
    setActiveSession(null);
    setRecoveryDraft(null);
    setDraftChecked(false);
    setOtherTabOpen(false);
    setLoading(Boolean(user));
    if (!user) {
      setLoading(false);
      return;
    }
    const client = getFirebaseClient();
    if (!client) {
      setLoading(false);
      setError("Firebase is not configured.");
      return;
    }
    let active = true;
    const unsubscribe = onSnapshot(
      activeSessionRef(client.db, user.uid),
      (snapshot) => {
        if (!active) return;
        if (!snapshot.exists()) {
          setActiveSession(null);
          setLoading(false);
          setDraftChecked(false);
          setRecoveryDraft(null);
          return;
        }
        const parsed = workoutSessionSchema.safeParse(snapshot.data());
        if (!parsed.success) {
          setError("The active workout draft is malformed and was not loaded.");
          setLoading(false);
          return;
        }
        setActiveSession(parsed.data);
        setRecoveryDraft(null);
        setDraftChecked(true);
        setLoading(false);
        void saveDraftBackup(user.uid, parsed.data);
      },
      (cause) => {
        if (!active) return;
        setError(
          (cause as { code?: string }).code === "permission-denied"
            ? "Firestore denied access to your active workout."
            : cause instanceof Error
              ? cause.message
              : "Could not load the active workout.",
        );
        setLoading(false);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  // Detect a recoverable local draft when Firestore has no active workout and
  // that workout was not actually completed in another tab.
  React.useEffect(() => {
    if (!user || activeSession || loading || sessionsLoading) return;
    if (draftChecked) return;
    let active = true;
    void loadDraftBackup(user.uid).then((draft) => {
      if (!active) return;
      setDraftChecked(true);
      if (!draft) return;
      const completed = sessions.some(
        (session) => session.id === draft.session.id,
      );
      if (completed) {
        void clearDraftBackup(user.uid);
        return;
      }
      setRecoveryDraft(draft);
    });
    return () => {
      active = false;
    };
  }, [
    user,
    activeSession,
    loading,
    sessionsLoading,
    sessions,
    draftChecked,
  ]);

  React.useEffect(() => {
    if (typeof BroadcastChannel === "undefined" || !user) return;
    const channel = new BroadcastChannel("forge-active-workout");
    channel.postMessage({ type: "hello", tabId });
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; tabId?: string };
      if (!data?.tabId || data.tabId === tabId) return;
      if (data.type === "hello") {
        channel.postMessage({ type: "present", tabId });
        setOtherTabOpen(true);
      }
      if (data.type === "present") setOtherTabOpen(true);
      if (data.type === "bye") setOtherTabOpen(false);
    };
    channel.addEventListener("message", onMessage);
    return () => {
      channel.postMessage({ type: "bye", tabId });
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [user, tabId]);

  const restoreDraft = React.useCallback(async () => {
    if (!user || !recoveryDraft) return;
    await saveActiveSession(user.uid, recoveryDraft.session);
    await clearDraftBackup(user.uid);
    setRecoveryDraft(null);
  }, [user, recoveryDraft]);

  const discardRecoveryDraft = React.useCallback(async () => {
    if (!user) return;
    await clearDraftBackup(user.uid);
    setRecoveryDraft(null);
  }, [user]);

  const value = React.useMemo(
    () => ({
      activeSession,
      loading,
      error,
      recoveryDraft,
      restoreDraft,
      discardRecoveryDraft,
      otherTabOpen,
    }),
    [
      activeSession,
      loading,
      error,
      recoveryDraft,
      restoreDraft,
      discardRecoveryDraft,
      otherTabOpen,
    ],
  );

  return (
    <ActiveWorkoutContext.Provider value={value}>
      {children}
    </ActiveWorkoutContext.Provider>
  );
}

export function useActiveWorkout(): ActiveWorkoutContextValue {
  const context = React.useContext(ActiveWorkoutContext);
  if (!context) {
    throw new Error(
      "useActiveWorkout must be used inside ActiveWorkoutProvider",
    );
  }
  return context;
}
