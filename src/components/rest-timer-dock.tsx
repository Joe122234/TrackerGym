"use client";

import { Check, Pause, Play, Plus, RotateCcw, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRestTimer } from "@/hooks/use-rest-timer";
import { formatDuration } from "@/domain/dates";
import { Button } from "@/components/ui/button";

export function RestTimerDock({ className }: { className?: string }) {
  const {
    phase,
    durationSeconds,
    remainingSeconds,
    label,
    pause,
    resume,
    addTime,
    dismiss,
    reset,
  } = useRestTimer();

  if (phase === "idle") return null;

  const progress =
    durationSeconds > 0
      ? Math.max(0, Math.min(100, (remainingSeconds / durationSeconds) * 100))
      : 0;
  const done = phase === "done";

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6 md:justify-end md:px-6",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border bg-surface/95 shadow-2xl shadow-black/50 backdrop-blur-xl animate-slide-up",
          done ? "border-lime/40" : "border-line-strong",
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 p-3.5">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl border",
              done
                ? "border-lime/25 bg-lime/10 text-lime"
                : "border-line bg-elevated text-muted",
            )}
          >
            {done ? (
              <Check className="size-5" />
            ) : (
              <Timer className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[12px] font-medium text-muted">
                {done ? "Rest complete" : label || "Rest timer"}
              </p>
              <span
                className={cn(
                  "tabular text-[15px] font-semibold tracking-[-0.02em]",
                  done ? "text-lime" : "text-ink",
                )}
              >
                {done ? "Go" : formatDuration(remainingSeconds)}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-elevated-2">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300 ease-linear",
                  done ? "bg-lime" : "bg-lime/70",
                )}
                style={{ width: `${done ? 100 : progress}%` }}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            {done ? (
              <Button
                size="iconSm"
                variant="ghost"
                onClick={dismiss}
                aria-label="Dismiss rest timer"
              >
                <X />
              </Button>
            ) : (
              <>
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={phase === "running" ? pause : resume}
                  aria-label={phase === "running" ? "Pause timer" : "Resume timer"}
                >
                  {phase === "running" ? <Pause /> : <Play />}
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={() => addTime(30)}
                  aria-label="Add 30 seconds"
                  className="hidden sm:inline-flex"
                >
                  <Plus />
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={reset}
                  aria-label="Restart timer"
                >
                  <RotateCcw />
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={dismiss}
                  aria-label="Dismiss timer"
                >
                  <X />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
