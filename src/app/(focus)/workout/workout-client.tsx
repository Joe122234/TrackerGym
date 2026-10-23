"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  CloudOff,
  Dumbbell,
  Flag,
  History,
  LoaderCircle,
  Moon,
  NotebookPen,
  RefreshCcw,
  ShieldAlert,
  Trash2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import type {
  CardioRecord,
  SessionExercise,
  SessionSet,
  WorkoutSession,
} from "@/domain/types";
import {
  calculateElapsedSeconds,
  createSetForExercise,
  getSessionSetCounts,
  getTotalVolumeKg,
  normalizeSessionAfterSetChanges,
} from "@/domain/workout";
import {
  formatDateKey,
  formatDuration,
  formatDurationLong,
  formatTimestamp,
} from "@/domain/dates";
import { formatVolume } from "@/domain/units";
import {
  discardActiveSession,
  finalizeActiveSession,
  saveActiveSession,
} from "@/lib/firebase/sessions";
import { useActiveWorkout } from "@/hooks/use-active-workout";
import {
  clearDraftBackup,
  saveDraftBackup,
} from "@/hooks/use-active-workout";
import { useAuth } from "@/hooks/use-auth";
import { useRestTimer } from "@/hooks/use-rest-timer";
import { useSessions } from "@/hooks/use-sessions";
import { useUserData } from "@/hooks/use-user-data";
import { BrandMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardioEditor } from "@/components/workout/cardio-editor";
import { ActiveExerciseCard } from "@/components/workout/active-exercise-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SaveStatus = "saved" | "saving" | "error";

const BLANK_CARDIO: CardioRecord = {
  activityType: "",
  durationSeconds: null,
  distanceKm: null,
  avgPaceSecondsPerKm: null,
  inclinePercent: null,
  speedKph: null,
  equipment: "",
  notes: "",
  intensity: null,
};

function useLiveNow(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function LiveElapsed({ startedAt }: { startedAt: number }) {
  const now = useLiveNow();
  return (
    <span className="tabular">{formatDuration(calculateElapsedSeconds(startedAt, now))}</span>
  );
}

function LiveDurationLong({ startedAt }: { startedAt: number }) {
  const now = useLiveNow();
  return <span>{formatDurationLong(calculateElapsedSeconds(startedAt, now))}</span>;
}

function SaveIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry: () => void;
}) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-muted-2">
        <LoaderCircle className="size-3 animate-spin" /> Saving
      </span>
    );
  }
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 text-[10px] text-danger"
      >
        <CloudOff className="size-3" /> Retry save
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-muted-2">
      <Check className="size-3 text-lime" /> Saved
    </span>
  );
}

function InvalidWorkout() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm text-center">
        <BrandMark className="mx-auto" />
        <h1 className="display mt-5 text-2xl font-semibold">No workout in progress</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Start today&apos;s session from your split, or pick a template. Only
          one workout can be active at a time.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild>
            <Link href="/workouts/?tab=schedule">
              Open my split <ChevronRight />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ActiveWorkoutClient() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useUserData();
  const {
    activeSession,
    loading,
    error,
    recoveryDraft,
    restoreDraft,
    discardRecoveryDraft,
    otherTabOpen,
  } = useActiveWorkout();
  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
    retry: retrySessions,
  } = useSessions();
  const {
    start: startRest,
    phase: timerPhase,
    dismiss: dismissRest,
  } = useRestTimer();
  const [session, setSession] = React.useState<WorkoutSession | null>(null);
  const sessionRef = React.useRef<WorkoutSession | null>(null);
  const initializedRef = React.useRef<string | null>(null);
  const dirtyRef = React.useRef(false);
  const closingRef = React.useRef(false);
  const saveChainRef = React.useRef<Promise<void>>(Promise.resolve());
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("saved");
  const [openExerciseId, setOpenExerciseId] = React.useState<string | null>(
    null,
  );
  const [finishOpen, setFinishOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);
  const [discarding, setDiscarding] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [recovering, setRecovering] = React.useState(false);
  const unit = profile?.weightUnit ?? "kg";

  React.useEffect(() => {
    if (!activeSession) return;
    if (initializedRef.current === activeSession.id) return;
    initializedRef.current = activeSession.id;
    sessionRef.current = activeSession;
    setSession(activeSession);
    dirtyRef.current = false;
    setSaveStatus("saved");
    const firstIncomplete =
      activeSession.exercises.find((exercise) =>
        exercise.sets.some((set) => set.status !== "completed"),
      ) ?? activeSession.exercises[0];
    setOpenExerciseId(firstIncomplete?.id ?? null);
  }, [activeSession]);

  const enqueueSave = React.useCallback(
    (uid: string, value: WorkoutSession): Promise<void> => {
      const task = saveChainRef.current
        .catch(() => undefined)
        .then(() => saveActiveSession(uid, value))
        .then(() => saveDraftBackup(uid, value));
      saveChainRef.current = task;
      return task;
    },
    [],
  );

  React.useEffect(() => {
    if (!session || !user || !dirtyRef.current) return;
    if (closingRef.current) return;
    setSaveStatus("saving");
    const revision = session.revision;
    const timer = window.setTimeout(() => {
      if (closingRef.current) return;
      void enqueueSave(user.uid, session)
        .then(() => {
          if (sessionRef.current?.revision === revision) {
            dirtyRef.current = false;
            setSaveStatus("saved");
          }
        })
        .catch((cause) => {
          setSaveStatus("error");
          console.error("Could not autosave workout", cause);
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [session, user, enqueueSave]);

  React.useEffect(() => {
    if (!user) return;
    const persistHidden = () => {
      if (
        document.visibilityState === "hidden" &&
        sessionRef.current &&
        dirtyRef.current &&
        !closingRef.current
      ) {
        void enqueueSave(user.uid, sessionRef.current).catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", persistHidden);
    return () =>
      document.removeEventListener("visibilitychange", persistHidden);
  }, [user, enqueueSave]);

  const applySession = React.useCallback(
    (updater: (current: WorkoutSession) => WorkoutSession) => {
      setSession((current) => {
        if (!current) return current;
        const next = updater(current);
        sessionRef.current = next;
        dirtyRef.current = true;
        return next;
      });
    },
    [],
  );

  const patchSet = (
    exerciseId: string,
    setId: string,
    patch: Partial<SessionSet>,
  ) => {
    const beforeExercise = sessionRef.current?.exercises.find(
      (exercise) => exercise.exerciseId === exerciseId,
    );
    const beforeSet = beforeExercise?.sets.find((set) => set.id === setId);
    applySession((current) => {
      const exercises = current.exercises.map((exercise) =>
        exercise.exerciseId === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId ? { ...set, ...patch } : set,
              ),
            }
          : exercise,
      );
      return normalizeSessionAfterSetChanges(current, exercises);
    });
    if (
      patch.status === "completed" &&
      beforeSet?.status !== "completed" &&
      beforeExercise &&
      beforeExercise.restSeconds > 0 &&
      (timerPhase === "idle" || timerPhase === "done")
    ) {
      startRest(beforeExercise.restSeconds, beforeExercise.name);
    }
  };

  const addSet = (exerciseId: string) => {
    applySession((current) => {
      const exercises = current.exercises.map((exercise) =>
        exercise.exerciseId === exerciseId
          ? {
              ...exercise,
              sets: [...exercise.sets, createSetForExercise(exercise)],
            }
          : exercise,
      );
      return normalizeSessionAfterSetChanges(current, exercises);
    });
  };

  const removeLastSet = (exerciseId: string) => {
    applySession((current) => {
      const exercises = current.exercises.map((exercise) =>
        exercise.exerciseId === exerciseId && exercise.sets.length > 1
          ? { ...exercise, sets: exercise.sets.slice(0, -1) }
          : exercise,
      );
      return normalizeSessionAfterSetChanges(current, exercises);
    });
  };

  const applySuggestion = (exercise: SessionExercise, weightKg: number) => {
    applySession((current) => {
      const exercises = current.exercises.map((candidate) =>
        candidate.exerciseId === exercise.exerciseId
          ? {
              ...candidate,
              sets: candidate.sets.map((set) =>
                set.status === "pending"
                  ? { ...set, weightKg }
                  : set,
              ),
            }
          : candidate,
      );
      return normalizeSessionAfterSetChanges(current, exercises);
    });
    toast.success("Suggestion applied to pending sets.");
  };

  const updateNotes = (notes: string) => {
    applySession((current) => ({
      ...current,
      notes,
      revision: current.revision + 1,
      updatedAt: Date.now(),
    }));
  };

  const updateCardio = (cardio: CardioRecord) => {
    applySession((current) => ({
      ...current,
      cardio,
      revision: current.revision + 1,
      updatedAt: Date.now(),
    }));
  };

  const handleExit = async () => {
    if (!user || !session) {
      router.push("/");
      return;
    }
    setLeaving(true);
    closingRef.current = true;
    try {
      if (dirtyRef.current || saveStatus === "error") {
        await enqueueSave(user.uid, sessionRef.current ?? session);
        dirtyRef.current = false;
      }
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Draft saved locally, but Firebase did not acknowledge it.",
      );
    } finally {
      router.push("/");
    }
  };

  const handleRetrySave = () => {
    if (!user || !sessionRef.current) return;
    setSaveStatus("saving");
    void enqueueSave(user.uid, sessionRef.current)
      .then(() => {
        dirtyRef.current = false;
        setSaveStatus("saved");
      })
      .catch((cause) => {
        setSaveStatus("error");
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Could not save the workout draft.",
        );
      });
  };

  const setCounts = session ? getSessionSetCounts(session) : null;
  const volume = session ? getTotalVolumeKg(session) : 0;
  const meaningful = session
    ? session.workoutType === "cardio"
      ? (session.cardio?.durationSeconds ?? 0) > 0 ||
        (session.cardio?.distanceKm ?? 0) > 0
      : (setCounts?.completed ?? 0) > 0
    : false;
  const canFinish =
    meaningful &&
    !sessionsLoading &&
    !sessionsError &&
    !finishing &&
    Boolean(session);

  const handleFinish = async () => {
    if (!user || !sessionRef.current) return;
    if (!canFinish) {
      if (!meaningful) {
        toast.error(
          sessionRef.current.workoutType === "cardio"
            ? "Add a duration or distance before finishing."
            : "Complete at least one set before finishing.",
        );
      } else if (sessionsError) {
        toast.error("Your workout history could not be loaded. Retry before finishing.");
      } else {
        toast.error("Workout history is still loading. Try again in a moment.");
      }
      return;
    }
    setFinishing(true);
    closingRef.current = true;
    try {
      await saveChainRef.current.catch(() => undefined);
      const completed = await finalizeActiveSession({
        uid: user.uid,
        session: sessionRef.current,
        previousSessions: sessions.filter(
          (candidate) => candidate.status === "completed",
        ),
      });
      await clearDraftBackup(user.uid);
      dismissRest();
      dirtyRef.current = false;
      toast.success(`${completed.templateName} saved.`);
      router.replace(
        `/workouts/session/?id=${encodeURIComponent(completed.id)}&finished=1`,
      );
    } catch (cause) {
      closingRef.current = false;
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not finish the workout. Your draft is still here.",
      );
    } finally {
      setFinishing(false);
    }
  };

  const handleDiscard = async () => {
    if (!user) return;
    setDiscarding(true);
    closingRef.current = true;
    try {
      await discardActiveSession(user.uid);
      await clearDraftBackup(user.uid);
      dismissRest();
      toast.success("Active workout discarded.");
      router.replace("/workouts/?tab=schedule");
    } catch (cause) {
      closingRef.current = false;
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not discard the workout.",
      );
    } finally {
      setDiscarding(false);
    }
  };

  const handleRestore = async () => {
    setRecovering(true);
    try {
      await restoreDraft();
      toast.success("Workout recovered.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not recover the local draft.",
      );
    } finally {
      setRecovering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <BrandMark className="mx-auto animate-pulse" />
          <p className="mt-4 text-sm text-muted">Opening your active workout…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        <div className="max-w-sm rounded-panel border border-danger/25 bg-surface p-6 text-center">
          <ShieldAlert className="mx-auto size-6 text-danger" />
          <p className="mt-3 text-sm text-danger">{error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            <RefreshCcw /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!activeSession && recoveryDraft) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-16">
        <Card className="w-full max-w-md p-6">
          <div className="flex size-11 items-center justify-center rounded-xl border border-warning/25 bg-warning/10 text-warning">
            <History className="size-5" />
          </div>
          <h1 className="display mt-4 text-2xl font-semibold">Recover your draft</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A local backup from{" "}
            {formatTimestamp(
              recoveryDraft.savedAt,
              profile?.timezone ?? "Asia/Bangkok",
              "MMM d · h:mm a",
            )}{" "}
            was found. It is not a completed workout.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={() => void handleRestore()} loading={recovering}>
              Recover workout <ChevronRight />
            </Button>
            <Button
              variant="secondary"
              onClick={() => void discardRecoveryDraft()}
            >
              Discard local backup
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!session) return <InvalidWorkout />;

  const cardio = session.cardio ?? BLANK_CARDIO;

  return (
    <div className="min-h-dvh pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => void handleExit()}
              disabled={leaving}
              aria-label="Save and exit workout"
            >
              <ArrowLeft />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-50" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-lime" />
                </span>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-lime/80">
                  Live · <LiveElapsed startedAt={session.startedAt} />
                </p>
              </div>
              <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink sm:text-base">
                {session.templateName}
              </h1>
            </div>
            <SaveIndicator status={saveStatus} onRetry={handleRetrySave} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-elevated-2">
              <div
                className="h-full rounded-full bg-lime transition-[width] duration-300"
                style={{
                  width: `${
                    setCounts && setCounts.total > 0
                      ? Math.round((setCounts.completed / setCounts.total) * 100)
                      : session.workoutType === "cardio" && meaningful
                        ? 100
                        : 0
                  }%`,
                }}
              />
            </div>
            <span className="tabular shrink-0 text-[10px] text-muted-2">
              {session.workoutType === "cardio"
                ? cardio.durationSeconds
                  ? formatDurationLong(cardio.durationSeconds)
                  : "No duration yet"
                : `${setCounts?.completed ?? 0}/${setCounts?.total ?? 0} sets`}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
        {otherTabOpen ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] p-3.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-[11px] leading-relaxed text-muted">
              This workout is open in another tab. Use only one tab to log
              sets; edits from different tabs can overwrite each other.
            </p>
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            {session.scheduledDay === "thursday" ? (
              <Moon className="size-3.5" />
            ) : (
              <Dumbbell className="size-3.5" />
            )}
            {formatDateKey(session.scheduledDate, "EEEE, MMMM d")}
          </span>
          <Badge variant={session.source === "scheduled" ? "lime" : "violet"}>
            {session.source === "scheduled" ? "Scheduled" : "Extra session"}
          </Badge>
          <span className="ml-auto flex items-center gap-1.5">
            <Wifi className="size-3" /> Autosave on
          </span>
        </div>

        {session.workoutType === "cardio" ? (
          <CardioEditor
            key={`${session.id}-cardio`}
            record={cardio}
            onChange={updateCardio}
          />
        ) : (
          <div className="space-y-3">
            {session.exercises.map((exercise) => (
              <ActiveExerciseCard
                key={exercise.id}
                exercise={exercise}
                unit={unit}
                sessions={sessions}
                sessionId={session.id}
                expanded={openExerciseId === exercise.id}
                onToggle={() =>
                  setOpenExerciseId((current) =>
                    current === exercise.id ? null : exercise.id,
                  )
                }
                onPatchSet={(setId, patch) =>
                  patchSet(exercise.exerciseId, setId, patch)
                }
                onAddSet={() => addSet(exercise.exerciseId)}
                onRemoveSet={() => removeLastSet(exercise.exerciseId)}
                onStartRest={startRest}
                onApplySuggestion={(weightKg) =>
                  applySuggestion(exercise, weightKg)
                }
              />
            ))}
          </div>
        )}

        <Card className="mt-4 p-4">
          <div className="flex items-center gap-2">
            <NotebookPen className="size-4 text-muted-2" />
            <h2 className="text-[12px] font-semibold text-ink">Session notes</h2>
            <span className="ml-auto text-[9px] text-muted-2">Optional</span>
          </div>
          <textarea
            value={session.notes}
            onChange={(event) => updateNotes(event.target.value)}
            placeholder="Energy, pain, setup changes, anything worth remembering…"
            rows={3}
            maxLength={2000}
            className="mt-2.5 w-full resize-y rounded-xl border border-line bg-canvas-soft px-3.5 py-2.5 text-[13px] text-ink outline-none placeholder:text-muted-2/70 focus:border-lime/60 focus:ring-2 focus:ring-lime/10"
          />
        </Card>

        <div className="mt-5 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-2 hover:text-danger"
            onClick={() => setDiscardOpen(true)}
          >
            <Trash2 /> Discard active workout
          </Button>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-ink">
              {session.workoutType === "cardio"
                ? cardio.activityType || "Cardio session"
                : `${setCounts?.completed ?? 0} of ${setCounts?.total ?? 0} sets logged`}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-muted-2">
              {session.workoutType === "cardio"
                ? <><LiveDurationLong startedAt={session.startedAt} /> elapsed</>
                : `${formatVolume(volume, unit)} volume · `}
              {session.workoutType === "cardio" ? null : (
                <>
                  <LiveDurationLong startedAt={session.startedAt} /> elapsed
                </>
              )}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => setFinishOpen(true)}
            disabled={sessionsLoading}
            className="shrink-0"
          >
            <Flag /> Finish
          </Button>
        </div>
      </div>

      <Dialog
        open={finishOpen}
        onOpenChange={(open) => {
          if (!finishing) setFinishOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish this workout?</DialogTitle>
            <DialogDescription>
              The session will be saved to your history and PRs will be
              calculated from your completed sets.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-line bg-canvas-soft/50 p-3 text-center">
              <p className="text-[9px] uppercase tracking-[0.12em] text-muted-2">
                Completed
              </p>
              <p className="tabular mt-1 text-lg font-semibold text-lime">
                {setCounts?.completed ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-canvas-soft/50 p-3 text-center">
              <p className="text-[9px] uppercase tracking-[0.12em] text-muted-2">
                Skipped
              </p>
              <p className="tabular mt-1 text-lg font-semibold text-warning">
                {setCounts?.skipped ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-canvas-soft/50 p-3 text-center">
              <p className="text-[9px] uppercase tracking-[0.12em] text-muted-2">
                Duration
              </p>
              <p className="tabular mt-1 text-lg font-semibold text-ink">
                <LiveDurationLong startedAt={session.startedAt} />
              </p>
            </div>
          </div>
          {(setCounts?.pending ?? 0) > 0 && session.workoutType === "strength" ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/[0.055] p-3 text-[11px] leading-relaxed text-muted">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              {setCounts?.pending} set{setCounts?.pending === 1 ? "" : "s"} will
              remain incomplete. They can be reviewed in the session summary.
            </div>
          ) : null}
          {!meaningful ? (
            <div className="mt-3 rounded-xl border border-danger/20 bg-danger/[0.055] p-3 text-[11px] leading-relaxed text-danger">
              {session.workoutType === "cardio"
                ? "Add a duration or distance before finishing."
                : "Complete at least one set before finishing."}
            </div>
          ) : null}
          {sessionsError ? (
            <div className="mt-3 rounded-xl border border-danger/20 bg-danger/[0.055] p-3 text-[11px] leading-relaxed text-danger">
              History could not be loaded, so PRs cannot be calculated safely.
              <button
                type="button"
                onClick={retrySessions}
                className="ml-1 underline underline-offset-2"
              >
                Retry history
              </button>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setFinishOpen(false)}
              disabled={finishing}
            >
              Keep training
            </Button>
            <Button
              onClick={() => void handleFinish()}
              loading={finishing}
              disabled={!canFinish}
            >
              <Check /> Finish & save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              The active draft and its local backup will be deleted. Completed
              history is not affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discarding}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={discarding}
              onClick={(event) => {
                event.preventDefault();
                void handleDiscard();
              }}
            >
              {discarding ? "Discarding…" : "Discard workout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
