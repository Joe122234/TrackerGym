"use client";

import * as React from "react";
import { Check, Minus, RotateCcw } from "lucide-react";
import type { SessionSet, WeightUnit } from "@/domain/types";
import { displayToKg, kgToDisplay, parseNumericInput, round } from "@/domain/units";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function SetRow({
  set,
  index,
  exerciseName,
  unit,
  descriptive,
  disabled = false,
  onPatch,
}: {
  set: SessionSet;
  index: number;
  exerciseName: string;
  unit: WeightUnit;
  descriptive: boolean;
  disabled?: boolean;
  onPatch: (patch: Partial<SessionSet>) => void;
}) {
  const [weightInput, setWeightInput] = React.useState(() =>
    set.weightKg === null ? "" : String(round(kgToDisplay(set.weightKg, unit), 2)),
  );
  const [repsInput, setRepsInput] = React.useState(() =>
    set.reps === null ? "" : String(set.reps),
  );
  const [descriptionInput, setDescriptionInput] = React.useState(
    set.loadDescription ?? "",
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setWeightInput(
      set.weightKg === null ? "" : String(round(kgToDisplay(set.weightKg, unit), 2)),
    );
    setRepsInput(set.reps === null ? "" : String(set.reps));
    setDescriptionInput(set.loadDescription ?? "");
  }, [set.id, set.weightKg, set.reps, set.loadDescription, unit]);

  const completed = set.status === "completed";
  const skipped = set.status === "skipped";

  const parseWeight = (): number | null | undefined => {
    if (descriptive) return null;
    const raw = weightInput.trim();
    if (raw === "") return null;
    const parsed = parseNumericInput(raw);
    if (parsed === null || parsed < 0 || parsed > 5000) return undefined;
    return round(displayToKg(parsed, unit), 3);
  };

  const parseReps = (): number | null | undefined => {
    const raw = repsInput.trim();
    if (raw === "") return null;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) {
      return undefined;
    }
    return parsed;
  };

  const commitDraft = (): boolean => {
    const weightKg = parseWeight();
    const reps = parseReps();
    if (weightKg === undefined) {
      setError(`Enter a valid weight in ${unit}.`);
      return false;
    }
    if (reps === undefined) {
      setError("Reps must be a whole number.");
      return false;
    }
    if (descriptive && descriptionInput.trim().length > 120) {
      setError("Load description must be 120 characters or fewer.");
      return false;
    }
    setError(null);
    onPatch({
      weightKg,
      reps,
      loadDescription: descriptive
        ? descriptionInput.trim() || null
        : null,
      ...(reps !== null ? {} : { status: "pending", completedAt: null }),
    });
    return true;
  };

  const handleComplete = () => {
    if (completed) {
      onPatch({
        status: "pending",
        completedAt: null,
      });
      return;
    }
    const weightKg = parseWeight();
    const reps = parseReps();
    if (weightKg === undefined) {
      setError(`Enter a valid weight in ${unit}.`);
      return;
    }
    if (reps === null || reps === undefined || reps < 1) {
      setError("Enter at least one whole rep to complete this set.");
      return;
    }
    if (descriptionInput.trim().length > 120) {
      setError("Load description must be 120 characters or fewer.");
      return;
    }
    setError(null);
    onPatch({
      weightKg,
      reps,
      loadDescription: descriptive
        ? descriptionInput.trim() || null
        : null,
      status: "completed",
      completedAt: Date.now(),
    });
  };

  const handleSkip = () => {
    setError(null);
    onPatch({
      status: skipped ? "pending" : "skipped",
      completedAt: null,
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl border px-2 py-2 transition-colors sm:px-2.5",
        completed
          ? "border-lime/20 bg-lime/[0.045]"
          : skipped
            ? "border-line/50 bg-canvas-soft/30 opacity-60"
            : "border-line bg-canvas-soft/55",
      )}
    >
      <div className="grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_26px_34px] items-center gap-1.5 sm:gap-2">
        <span
          className={cn(
            "tabular flex size-6 items-center justify-center rounded-md border text-[10px] font-semibold",
            completed
              ? "border-lime/25 bg-lime/10 text-lime"
              : skipped
                ? "border-line bg-elevated text-muted-2"
                : "border-line bg-elevated text-muted",
          )}
        >
          {completed ? <Check className="size-3" /> : index + 1}
        </span>

        {descriptive ? (
          <div className="relative">
            <Input
              value={descriptionInput}
              onChange={(event) => setDescriptionInput(event.target.value)}
              onBlur={commitDraft}
              disabled={disabled || skipped}
              placeholder="Load description"
              aria-label={`Load description for ${exerciseName} set ${index + 1}`}
              className="h-10 bg-surface px-2 text-[12px]"
            />
          </div>
        ) : (
          <div className="relative">
            <Input
              inputMode="decimal"
              value={weightInput}
              onChange={(event) => {
                setWeightInput(event.target.value);
                setError(null);
              }}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              disabled={disabled || skipped}
              placeholder="—"
              aria-label={`Weight for ${exerciseName} set ${index + 1} in ${unit}`}
              className={cn(
                "tabular h-10 px-2 pr-7 text-center text-[14px] font-medium",
                completed && "border-lime/15",
              )}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-muted-2">
              {unit}
            </span>
          </div>
        )}

        <div className="relative">
          <Input
            inputMode="numeric"
            value={repsInput}
            onChange={(event) => {
              setRepsInput(event.target.value);
              setError(null);
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            disabled={disabled || skipped}
            placeholder="—"
            aria-label={`Reps for ${exerciseName} set ${index + 1}`}
            className={cn(
              "tabular h-10 px-2 pr-8 text-center text-[14px] font-medium",
              completed && "border-lime/15",
            )}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-muted-2">
            reps
          </span>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          disabled={disabled}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-2 transition-colors hover:bg-elevated hover:text-ink",
            skipped && "text-warning",
          )}
          aria-label={skipped ? `Unskip set ${index + 1}` : `Skip set ${index + 1}`}
        >
          {skipped ? <RotateCcw className="size-3.5" /> : <Minus className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={handleComplete}
          disabled={disabled}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border transition-all",
            completed
              ? "border-lime bg-lime text-canvas shadow-[0_0_18px_rgba(197,244,103,0.16)]"
              : "border-line-strong bg-elevated text-muted hover:border-lime/40 hover:text-lime",
          )}
          aria-label={
            completed
              ? `Mark set ${index + 1} incomplete`
              : `Complete set ${index + 1}`
          }
        >
          <Check className="size-4" />
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 pl-8 text-[10px] text-danger">{error}</p>
      ) : null}
    </div>
  );
}
