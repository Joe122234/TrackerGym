"use client";

import * as React from "react";
import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import type {
  ExerciseDefinition,
  Preferences,
  Profile,
  ScheduleEntry,
  WorkoutTemplate,
} from "@/domain/types";
import {
  exerciseDefinitionSchema,
  preferencesSchema,
  profileSchema,
  scheduleEntrySchema,
  workoutTemplateSchema,
} from "@/domain/schemas";
import { WEEKDAYS } from "@/domain/types";
import { getFirebaseClient } from "@/lib/firebase/client";
import { migrateLegacyLogIfNeeded } from "@/lib/firebase/migrate-legacy";
import { ensureUserInitialized } from "@/lib/firebase/seed";
import {
  exerciseDefinitionsCollection,
  preferencesRef,
  profileRef,
  scheduleCollection,
  templatesCollection,
} from "@/lib/firebase/paths";
import { useAuth } from "./use-auth";

interface UserDataContextValue {
  profile: Profile | null;
  preferences: Preferences | null;
  templates: WorkoutTemplate[];
  schedule: ScheduleEntry[];
  exerciseDefinitions: ExerciseDefinition[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const UserDataContext = React.createContext<UserDataContextValue | null>(null);

function snapshotError(cause: unknown): string {
  const code = (cause as { code?: string }).code;
  if (code === "permission-denied") {
    return "Firestore denied access to your data. Check that security rules are deployed for this project.";
  }
  if (code === "failed-precondition") {
    return "Firestore needs an index for this query. Deploy firestore.indexes.json and try again.";
  }
  if (cause instanceof Error) return cause.message;
  return "Could not load your training data.";
}

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [preferences, setPreferences] = React.useState<Preferences | null>(
    null,
  );
  const [templates, setTemplates] = React.useState<WorkoutTemplate[]>([]);
  const [schedule, setSchedule] = React.useState<ScheduleEntry[]>([]);
  const [exerciseDefinitions, setExerciseDefinitions] = React.useState<
    ExerciseDefinition[]
  >([]);
  const [loadedParts, setLoadedParts] = React.useState<Record<string, boolean>>(
    {},
  );
  const [seeding, setSeeding] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    setProfile(null);
    setPreferences(null);
    setTemplates([]);
    setSchedule([]);
    setExerciseDefinitions([]);
    setLoadedParts({});
    setError(null);
    setSeeding(Boolean(user));

    if (!user) {
      setSeeding(false);
      return;
    }
    const client = getFirebaseClient();
    if (!client) {
      setError("Firebase is not configured.");
      setSeeding(false);
      return;
    }

    let active = true;
    const unsubscribes: Array<() => void> = [];
    const markLoaded = (part: string) => {
      if (!active) return;
      setLoadedParts((current) => ({ ...current, [part]: true }));
    };

    const subscribeDoc = <T extends DocumentData>(
      ref: DocumentReference<T>,
      part: string,
      parser: (data: unknown) => T | null,
      onData: (data: T | null) => void,
    ) => {
      unsubscribes.push(
        onSnapshot(
          ref,
          (snapshot) => {
            if (!active) return;
            if (!snapshot.exists()) {
              onData(null);
              markLoaded(part);
              return;
            }
            const parsed = parser(snapshot.data());
            if (!parsed) {
              setError(
                `The ${part} document is malformed and could not be read.`,
              );
            } else {
              onData(parsed);
            }
            markLoaded(part);
          },
          (cause) => {
            if (!active) return;
            setError(snapshotError(cause));
            markLoaded(part);
          },
        ),
      );
    };

    void (async () => {
      await migrateLegacyLogIfNeeded();
      await ensureUserInitialized(user.uid);
      if (!active) return;
      setSeeding(false);

      subscribeDoc(
        profileRef(client.db, user.uid),
        "profile",
        (data) => {
          const result = profileSchema.safeParse(data);
          return result.success ? result.data : null;
        },
        setProfile,
      );
      subscribeDoc(
        preferencesRef(client.db, user.uid),
        "preferences",
        (data) => {
          const result = preferencesSchema.safeParse(data);
          return result.success ? result.data : null;
        },
        setPreferences,
      );

      unsubscribes.push(
        onSnapshot(
          exerciseDefinitionsCollection(client.db, user.uid),
          (snapshot) => {
            if (!active) return;
            const parsed: ExerciseDefinition[] = [];
            for (const document of snapshot.docs) {
              const result = exerciseDefinitionSchema.safeParse(
                document.data(),
              );
              if (result.success) parsed.push(result.data);
            }
            parsed.sort((a, b) => a.name.localeCompare(b.name));
            setExerciseDefinitions(parsed);
            markLoaded("exercises");
          },
          (cause) => {
            if (!active) return;
            setError(snapshotError(cause));
            markLoaded("exercises");
          },
        ),
      );

      unsubscribes.push(
        onSnapshot(
          templatesCollection(client.db, user.uid),
          (snapshot) => {
            if (!active) return;
            const parsed: WorkoutTemplate[] = [];
            for (const document of snapshot.docs) {
              const result = workoutTemplateSchema.safeParse(document.data());
              if (result.success) parsed.push(result.data);
            }
            parsed.sort((a, b) => a.createdAt - b.createdAt);
            setTemplates(parsed);
            markLoaded("templates");
          },
          (cause) => {
            if (!active) return;
            setError(snapshotError(cause));
            markLoaded("templates");
          },
        ),
      );

      unsubscribes.push(
        onSnapshot(
          scheduleCollection(client.db, user.uid),
          (snapshot) => {
            if (!active) return;
            const parsed: ScheduleEntry[] = [];
            for (const document of snapshot.docs) {
              const result = scheduleEntrySchema.safeParse(document.data());
              if (result.success) parsed.push(result.data);
            }
            parsed.sort(
              (a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day),
            );
            setSchedule(parsed);
            markLoaded("schedule");
          },
          (cause) => {
            if (!active) return;
            setError(snapshotError(cause));
            markLoaded("schedule");
          },
        ),
      );
    })().catch((cause) => {
      if (!active) return;
      setError(
        `Setup could not finish. ${cause instanceof Error ? cause.message : "Please retry."}`,
      );
      setSeeding(false);
    });

    return () => {
      active = false;
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [user, retryKey]);

  const loading =
    Boolean(user) &&
    (seeding ||
      Object.keys(loadedParts).length < 5 ||
      !profile ||
      !preferences);

  const value = React.useMemo(
    () => ({
      profile,
      preferences,
      templates,
      schedule,
      exerciseDefinitions,
      loading,
      error,
      retry: () => setRetryKey((key) => key + 1),
    }),
    [
      profile,
      preferences,
      templates,
      schedule,
      exerciseDefinitions,
      loading,
      error,
    ],
  );

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData(): UserDataContextValue {
  const context = React.useContext(UserDataContext);
  if (!context) {
    throw new Error("useUserData must be used inside UserDataProvider");
  }
  return context;
}
