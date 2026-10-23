"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { WorkoutTemplate } from "@/domain/types";
import { startActiveSession } from "@/lib/firebase/sessions";
import { saveDraftBackup } from "./use-active-workout";
import { useActiveWorkout } from "./use-active-workout";
import { useAuth } from "./use-auth";
import { useSessions } from "./use-sessions";
import { useUserData } from "./use-user-data";

export function useStartWorkout() {
  const { user } = useAuth();
  const { profile, schedule, exerciseDefinitions } = useUserData();
  const { sessions } = useSessions();
  const { activeSession, loading: activeLoading } = useActiveWorkout();
  const router = useRouter();
  const [startingId, setStartingId] = React.useState<string | null>(null);

  const startWorkout = React.useCallback(
    async (template: WorkoutTemplate) => {
      if (!user || !profile) {
        toast.error("Your profile is still loading. Try again in a moment.");
        return null;
      }
      if (activeSession) {
        router.push("/workout/");
        return activeSession;
      }
      setStartingId(template.id);
      try {
        const session = await startActiveSession({
          uid: user.uid,
          template,
          definitions: exerciseDefinitions,
          schedule,
          sessions,
          timezone: profile.timezone,
          now: Date.now(),
        });
        await saveDraftBackup(user.uid, session);
        router.push("/workout/");
        return session;
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Could not start this workout. Try again.",
        );
        return null;
      } finally {
        setStartingId(null);
      }
    },
    [
      user,
      profile,
      activeSession,
      router,
      exerciseDefinitions,
      schedule,
      sessions,
    ],
  );

  return {
    startWorkout,
    startingId,
    activeSession,
    activeLoading,
  };
}
