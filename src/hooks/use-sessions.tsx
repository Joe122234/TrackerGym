"use client";

import * as React from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import type { WorkoutSession } from "@/domain/types";
import { workoutSessionSchema } from "@/domain/schemas";
import { getFirebaseClient } from "@/lib/firebase/client";
import { useAuth } from "./use-auth";

interface SessionsContextValue {
  sessions: WorkoutSession[];
  loading: boolean;
  error: string | null;
  pendingWrites: boolean;
  retry: () => void;
}

const SessionsContext = React.createContext<SessionsContextValue | null>(null);

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sessions, setSessions] = React.useState<WorkoutSession[]>([]);
  const [loading, setLoading] = React.useState(Boolean(user));
  const [error, setError] = React.useState<string | null>(null);
  const [pendingWrites, setPendingWrites] = React.useState(false);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    setSessions([]);
    setError(null);
    setLoading(Boolean(user));
    setPendingWrites(false);
    if (!user) {
      setLoading(false);
      return;
    }
    const client = getFirebaseClient();
    if (!client) {
      setError("Firebase is not configured.");
      setLoading(false);
      return;
    }

    let active = true;
    const unsubscribe = onSnapshot(
      query(
        collection(client.db, "users", user.uid, "workoutSessions"),
        orderBy("startedAt", "desc"),
      ),
      (snapshot) => {
        if (!active) return;
        const completed: WorkoutSession[] = [];
        for (const document of snapshot.docs) {
          const parsed = workoutSessionSchema.safeParse(document.data());
          if (!parsed.success) {
            console.error("Invalid workout session", document.id, parsed.error);
            continue;
          }
          if (parsed.data.status === "completed") completed.push(parsed.data);
        }
        completed.sort((a, b) => b.startedAt - a.startedAt);
        setSessions(completed);
        setPendingWrites(snapshot.metadata.hasPendingWrites);
        setLoading(false);
        setError(null);
      },
      (cause) => {
        if (!active) return;
        const code = (cause as { code?: string }).code;
        setError(
          code === "permission-denied"
            ? "Firestore denied access to workout history. Check your deployed security rules."
            : cause instanceof Error
              ? cause.message
              : "Could not load workout history.",
        );
        setLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, retryKey]);

  const value = React.useMemo(
    () => ({
      sessions,
      loading,
      error,
      pendingWrites,
      retry: () => setRetryKey((key) => key + 1),
    }),
    [sessions, loading, error, pendingWrites],
  );

  return (
    <SessionsContext.Provider value={value}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions(): SessionsContextValue {
  const context = React.useContext(SessionsContext);
  if (!context) {
    throw new Error("useSessions must be used inside SessionsProvider");
  }
  return context;
}
