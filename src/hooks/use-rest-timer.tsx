"use client";

import * as React from "react";
import { useUserData } from "./use-user-data";

type TimerPhase = "idle" | "running" | "paused" | "done";

interface RestTimerState {
  phase: TimerPhase;
  durationSeconds: number;
  deadline: number | null;
  pausedRemainingSeconds: number;
  label: string;
  finishedAt: number | null;
}

interface StoredTimer extends RestTimerState {
  version: 1;
}

interface RestTimerContextValue {
  phase: TimerPhase;
  durationSeconds: number;
  remainingSeconds: number;
  label: string;
  start: (seconds: number, label?: string) => void;
  pause: () => void;
  resume: () => void;
  addTime: (seconds: number) => void;
  dismiss: () => void;
  reset: () => void;
}

const STORAGE_KEY = "forge.restTimer.v1";
const DEFAULT_STATE: RestTimerState = {
  phase: "idle",
  durationSeconds: 0,
  deadline: null,
  pausedRemainingSeconds: 0,
  label: "",
  finishedAt: null,
};

const RestTimerContext = React.createContext<RestTimerContextValue | null>(
  null,
);

function playChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    gain.connect(context.destination);
    const first = context.createOscillator();
    first.type = "sine";
    first.frequency.value = 880;
    first.connect(gain);
    first.start(now);
    first.stop(now + 0.3);
    const second = context.createOscillator();
    second.type = "sine";
    second.frequency.value = 1174.66;
    second.connect(gain);
    second.start(now + 0.18);
    second.stop(now + 0.55);
    window.setTimeout(() => void context.close(), 900);
  } catch {
    // Audio is a progressive enhancement only.
  }
}

export function RestTimerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { preferences } = useUserData();
  const [state, setState] = React.useState<RestTimerState>(DEFAULT_STATE);
  const [clock, setClock] = React.useState(() => Date.now());
  const [hydrated, setHydrated] = React.useState(false);
  const completionRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredTimer;
        if (parsed.version === 1) {
          const age =
            parsed.finishedAt === null ? 0 : Date.now() - parsed.finishedAt;
          if (parsed.phase === "running" && parsed.deadline !== null) {
            if (parsed.deadline <= Date.now()) {
              setState({
                ...parsed,
                phase: "done",
                finishedAt: Date.now(),
                pausedRemainingSeconds: 0,
              });
            } else {
              setState(parsed);
            }
          } else if (parsed.phase === "paused" || parsed.phase === "done") {
            if (parsed.phase !== "done" || age < 30 * 60 * 1000) {
              setState(parsed);
            }
          }
        }
      }
    } catch {
      // Ignore corrupt local timer data.
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    const stored: StoredTimer = { ...state, version: 1 };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage can be unavailable in private mode.
    }
  }, [state, hydrated]);

  React.useEffect(() => {
    if (state.phase !== "running") return;
    const update = () => setClock(Date.now());
    update();
    const interval = window.setInterval(update, 250);
    const onVisibility = () => update();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [state.phase]);

  const remainingFromDeadline =
    state.phase === "running" && state.deadline
      ? Math.max(0, Math.ceil((state.deadline - clock) / 1000))
      : state.phase === "paused"
        ? state.pausedRemainingSeconds
        : state.phase === "done"
          ? 0
          : 0;

  React.useEffect(() => {
    if (state.phase !== "running") return;
    if (state.deadline === null) return;
    if (Date.now() < state.deadline) return;
    const stamp = state.deadline;
    if (completionRef.current === stamp) return;
    completionRef.current = stamp;
    setState((current) =>
      current.phase === "running"
        ? {
            ...current,
            phase: "done",
            deadline: null,
            pausedRemainingSeconds: 0,
            finishedAt: Date.now(),
          }
        : current,
    );
    setClock(Date.now());
    if (preferences?.timerSound !== false) playChime();
    if (
      preferences?.timerVibration !== false &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      navigator.vibrate([90, 60, 120]);
    }
  }, [state.deadline, state.phase, clock, preferences]);

  const start = React.useCallback(
    (seconds: number, label = "") => {
      const safe = Math.max(5, Math.min(3600, Math.round(seconds)));
      completionRef.current = null;
      setClock(Date.now());
      setState({
        phase: "running",
        durationSeconds: safe,
        deadline: Date.now() + safe * 1000,
        pausedRemainingSeconds: safe,
        label,
        finishedAt: null,
      });
      // A tiny silent context unlock improves the chime's reliability after a
      // user gesture on iOS without playing a sound yet.
      try {
        const AudioContextClass =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (AudioContextClass) {
          const context = new AudioContextClass();
          void context.resume().then(() => context.close());
        }
      } catch {
        // Ignore.
      }
    },
    [],
  );

  const pause = React.useCallback(() => {
    setState((current) => {
      if (current.phase !== "running" || current.deadline === null) {
        return current;
      }
      return {
        ...current,
        phase: "paused",
        pausedRemainingSeconds: Math.max(
          0,
          Math.ceil((current.deadline - Date.now()) / 1000),
        ),
        deadline: null,
      };
    });
  }, []);

  const resume = React.useCallback(() => {
    setState((current) => {
      if (current.phase !== "paused") return current;
      const remaining = Math.max(1, current.pausedRemainingSeconds);
      return {
        ...current,
        phase: "running",
        deadline: Date.now() + remaining * 1000,
        pausedRemainingSeconds: remaining,
      };
    });
    setClock(Date.now());
  }, []);

  const addTime = React.useCallback((seconds: number) => {
    setState((current) => {
      if (current.phase === "running" && current.deadline !== null) {
        return { ...current, deadline: current.deadline + seconds * 1000 };
      }
      if (current.phase === "paused") {
        return {
          ...current,
          pausedRemainingSeconds: Math.max(
            1,
            current.pausedRemainingSeconds + seconds,
          ),
        };
      }
      if (current.phase === "done") {
        return {
          phase: "running",
          durationSeconds: seconds,
          deadline: Date.now() + seconds * 1000,
          pausedRemainingSeconds: seconds,
          label: current.label,
          finishedAt: null,
        };
      }
      return current;
    });
    setClock(Date.now());
  }, []);

  const dismiss = React.useCallback(() => {
    completionRef.current = null;
    setState(DEFAULT_STATE);
  }, []);

  const reset = React.useCallback(() => {
    setState((current) => {
      if (current.durationSeconds <= 0) return DEFAULT_STATE;
      completionRef.current = null;
      return {
        phase: "running",
        durationSeconds: current.durationSeconds,
        deadline: Date.now() + current.durationSeconds * 1000,
        pausedRemainingSeconds: current.durationSeconds,
        label: current.label,
        finishedAt: null,
      };
    });
    setClock(Date.now());
  }, []);

  const startWithDefault = React.useCallback(
    (seconds: number, label = "") => start(seconds, label),
    [start],
  );

  const value = React.useMemo<RestTimerContextValue>(
    () => ({
      phase: state.phase,
      durationSeconds: state.durationSeconds,
      remainingSeconds: remainingFromDeadline,
      label: state.label,
      start: startWithDefault,
      pause,
      resume,
      addTime,
      dismiss,
      reset,
    }),
    [
      state.phase,
      state.durationSeconds,
      state.label,
      remainingFromDeadline,
      startWithDefault,
      pause,
      resume,
      addTime,
      dismiss,
      reset,
    ],
  );

  return (
    <RestTimerContext.Provider value={value}>
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer(): RestTimerContextValue {
  const context = React.useContext(RestTimerContext);
  if (!context) {
    throw new Error("useRestTimer must be used inside RestTimerProvider");
  }
  return context;
}
