"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Dumbbell,
  Minus,
  Plus,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";
import type {
  SessionExercise,
  SessionSet,
  WeightUnit,
  WorkoutSession,
} from "@/domain/types";
import { formatDateKey } from "@/domain/dates";
import { findLastExercisePerformance } from "@/domain/workout";
import { getProgressionRecommendation } from "@/domain/progression";
import { formatWeight } from "@/domain/units";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SetRow } from "@/components/workout/set-row";

function LoadLabel({
  exercise,
  unit,
}: {
  exercise: SessionExercise;
  unit: WeightUnit;
}) {
  if (exercise.load?.kind === "descriptive") {
    return <span className="text-muted">{exercise.load.label}</span>;
  }
  if (exercise.load?.kind === "numeric") {
    return (
      <span className="text-muted">
        {formatWeight(exercise.load.kg, unit, {
          includeBasis:
            exercise.load.basis === "perDumbbell" ||
            exercise.load.basis === "perSide"
              ? exercise.load.basis
              : null,
        })}
      </span>
    );
  }
  return <span className="text-muted-2">Load not set</span>;
}

function performanceSet(set: SessionSet, unit: WeightUnit): string {
  const reps = set.reps === null ? "—" : String(set.reps);
  if (set.loadDescription) {
    return `${set.loadDescription} × ${reps}`;
  }
  if (set.weightKg !== null) {
    return `${formatWeight(set.weightKg, unit, { withUnit: false })} × ${reps}`;
  }
  return `${reps} reps`;
}

export function ActiveExerciseCard({
  exercise,
  unit,
  sessions,
  sessionId,
  expanded,
  onToggle,
  onPatchSet,
  onAddSet,
  onRemoveSet,
  onStartRest,
  onApplySuggestion,
}: {
  exercise: SessionExercise;
  unit: WeightUnit;
  sessions: WorkoutSession[];
  sessionId: string;
  expanded: boolean;
  onToggle: () => void;
  onPatchSet: (setId: string, patch: Partial<SessionSet>) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onStartRest: (seconds: number, label: string) => void;
  onApplySuggestion: (weightKg: number) => void;
}) {
  const completed = exercise.sets.filter(
    (set) => set.status === "completed",
  ).length;
  const skipped = exercise.sets.filter((set) => set.status === "skipped").length;
  const total = exercise.sets.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const descriptive = exercise.load?.kind === "descriptive";
  const last = React.useMemo(
    () => findLastExercisePerformance(sessions, exercise.exerciseId, sessionId),
    [sessions, exercise.exerciseId, sessionId],
  );
  const recommendation = React.useMemo(
    () =>
      getProgressionRecommendation({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        sessions,
        defaultLoad: exercise.load,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
        incrementKg: exercise.progressionIncrementKg,
        unit,
      }),
    [
      sessions,
      exercise.exerciseId,
      exercise.name,
      exercise.load,
      exercise.targetSets,
      exercise.targetReps,
      exercise.progressionIncrementKg,
      unit,
    ],
  );
  const showRecommendation = ![
    "insufficient",
    "manual",
  ].includes(recommendation.kind);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-panel border bg-surface transition-colors",
        completed === total && total > 0
          ? "border-lime/25"
          : expanded
            ? "border-line-strong"
            : "border-line",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-elevated/25 sm:p-5"
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl border text-[11px] font-semibold",
            completed === total && total > 0
              ? "border-lime/25 bg-lime/10 text-lime"
              : "border-line bg-elevated text-muted-2",
          )}
        >
          {String(exercise.order + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-[14px] font-semibold tracking-[-0.015em] text-ink sm:text-[15px]">
              {exercise.name}
            </h2>
            {descriptive ? <Badge variant="outline">Text load</Badge> : null}
            {completed === total && total > 0 ? (
              <Badge variant="success" dot>
                Done
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-2">
            <span className="tabular">
              {exercise.targetSets} × {exercise.targetReps}
            </span>
            <span aria-hidden>·</span>
            <LoadLabel exercise={exercise} unit={unit} />
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" /> {exercise.restSeconds}s
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="tabular text-[11px] font-medium text-muted">
              {completed}/{total}
            </p>
            {skipped > 0 ? (
              <p className="text-[9px] text-warning">{skipped} skipped</p>
            ) : null}
          </div>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-2" />
          ) : (
            <ChevronDown className="size-4 text-muted-2" />
          )}
        </div>
      </button>

      <div className="h-px bg-line/60">
        <div
          className={cn(
            "h-px transition-[width] duration-300",
            completed === total && total > 0 ? "bg-lime" : "bg-lime/40",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {expanded ? (
        <div className="p-3 sm:p-4">
          {exercise.note ? (
            <p className="mb-3 rounded-lg border border-line/60 bg-canvas-soft/45 px-3 py-2 text-[10px] leading-relaxed text-muted">
              {exercise.note}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 rounded-xl border border-line/60 bg-canvas-soft/35 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {last ? (
                <>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-2">
                    Last time · {formatDateKey(last.scheduledDate, "MMM d")}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {last.sets.length > 0
                      ? last.sets.map((set) => performanceSet(set, unit)).join(" · ")
                      : "No completed sets recorded."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-2">
                    First time logged
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    This exercise has no completed history yet. Log the honest
                    baseline.
                  </p>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {exercise.restSeconds > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onStartRest(exercise.restSeconds!, exercise.name)
                  }
                >
                  <Timer /> Rest
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={onToggle}>
                <Minus /> Collapse
              </Button>
            </div>
          </div>

          {showRecommendation ? (
            <div
              className={cn(
                "mt-2.5 rounded-xl border p-3",
                recommendation.kind === "increase"
                  ? "border-lime/20 bg-lime/[0.045]"
                  : "border-line/70 bg-canvas-soft/40",
              )}
            >
              <div className="flex items-start gap-2">
                <Sparkles
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    recommendation.kind === "increase"
                      ? "text-lime"
                      : "text-muted-2",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-ink">
                    {recommendation.title}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                    {recommendation.detail}
                  </p>
                </div>
                {recommendation.suggestedWeightKg !== null ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      onApplySuggestion(recommendation.suggestedWeightKg!)
                    }
                  >
                    Use {formatWeight(recommendation.suggestedWeightKg, unit, { withUnit: false })}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_26px_34px] gap-1.5 px-2 pb-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-muted-2 sm:gap-2 sm:px-2.5">
            <span>Set</span>
            <span className="text-center">{descriptive ? "Load" : unit}</span>
            <span className="text-center">Reps</span>
            <span />
            <span className="text-center">Done</span>
          </div>

          <div className="space-y-1.5">
            {exercise.sets.map((set, index) => (
              <SetRow
                key={set.id}
                set={set}
                index={index}
                exerciseName={exercise.name}
                unit={unit}
                descriptive={descriptive}
                onPatch={(patch) => onPatchSet(set.id, patch)}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={onAddSet}>
              <Plus /> Add set
            </Button>
            {exercise.sets.length > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemoveSet}
                className="text-muted-2 hover:text-danger"
              >
                <Trash2 /> Remove last
              </Button>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-muted-2">
                <Dumbbell className="size-3" /> Mark done or skip each set
              </span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
