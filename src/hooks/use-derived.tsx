"use client";

import * as React from "react";
import { onSnapshot } from "firebase/firestore";
import type { Achievement, PersonalRecord } from "@/domain/types";
import {
  achievementSchema,
  personalRecordSchema,
} from "@/domain/schemas";
import { getFirebaseClient } from "@/lib/firebase/client";
import { syncDerivedData } from "@/lib/firebase/derived";
import {
  achievementsCollection,
  personalRecordsCollection,
} from "@/lib/firebase/paths";
import { useAuth } from "./use-auth";
import { useSessions } from "./use-sessions";
import { useUserData } from "./use-user-data";

interface DerivedContextValue {
  records: PersonalRecord[];
  achievements: Achievement[];
  loading: boolean;
}

const DerivedContext = React.createContext<DerivedContextValue | null>(null);

export function DerivedProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const {
    profile,
    preferences,
    schedule,
    loading: userDataLoading,
  } = useUserData();
  const { sessions, loading: sessionsLoading } = useSessions();
  const [records, setRecords] = React.useState<PersonalRecord[]>([]);
  const [achievements, setAchievements] = React.useState<Achievement[]>([]);
  const [loading, setLoading] = React.useState(Boolean(user));
  const lastSyncedRef = React.useRef<string | null>(null);

  const sessionSignature = React.useMemo(
    () =>
      sessions
        .map(
          (session) =>
            `${session.id}:${session.revision}:${session.completedAt ?? 0}`,
        )
        .join("|"),
    [sessions],
  );

  React.useEffect(() => {
    if (
      !user ||
      userDataLoading ||
      sessionsLoading ||
      !profile ||
      !preferences
    ) {
      return;
    }
    const signature = `${profile.updatedAt}|${preferences.updatedAt}|${sessionSignature}`;
    if (lastSyncedRef.current === signature) return;
    const timer = window.setTimeout(() => {
      lastSyncedRef.current = signature;
      void syncDerivedData(user.uid, {
        sessions,
        schedule,
        profile,
        preferences,
      }).catch((cause) => {
        console.error("Could not refresh derived records", cause);
        lastSyncedRef.current = null;
      });
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    user,
    userDataLoading,
    sessionsLoading,
    profile,
    preferences,
    schedule,
    sessions,
    sessionSignature,
  ]);

  React.useEffect(() => {
    setRecords([]);
    setAchievements([]);
    setLoading(Boolean(user));
    if (!user) {
      setLoading(false);
      return;
    }
    const client = getFirebaseClient();
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;
    let loaded = 0;
    const done = () => {
      loaded += 1;
      if (loaded >= 2 && active) setLoading(false);
    };

    const unsubscribeRecords = onSnapshot(
      personalRecordsCollection(client.db, user.uid),
      (snapshot) => {
        if (!active) return;
        const parsed = snapshot.docs
          .map((document) =>
            personalRecordSchema.safeParse(document.data()),
          )
          .filter((result) => result.success)
          .map((result) => result.data)
          .sort((a, b) => b.achievedAt - a.achievedAt);
        setRecords(parsed);
        done();
      },
      () => done(),
    );

    const unsubscribeAchievements = onSnapshot(
      achievementsCollection(client.db, user.uid),
      (snapshot) => {
        if (!active) return;
        const parsed = snapshot.docs
          .map((document) => achievementSchema.safeParse(document.data()))
          .filter((result) => result.success)
          .map((result) => result.data)
          .sort((a, b) => b.earnedAt - a.earnedAt);
        setAchievements(parsed);
        done();
      },
      () => done(),
    );

    return () => {
      active = false;
      unsubscribeRecords();
      unsubscribeAchievements();
    };
  }, [user]);

  const value = React.useMemo(
    () => ({ records, achievements, loading }),
    [records, achievements, loading],
  );

  return (
    <DerivedContext.Provider value={value}>{children}</DerivedContext.Provider>
  );
}

export function useDerived(): DerivedContextValue {
  const context = React.useContext(DerivedContext);
  if (!context) {
    throw new Error("useDerived must be used inside DerivedProvider");
  }
  return context;
}
