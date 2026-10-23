"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  GripVertical,
  HeartPulse,
  Info,
  Layers,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ExerciseDefinition,
  LoadBasis,
  TemplateExercise,
  Weekday,
  WorkoutTemplate,
} from "@/domain/types";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/domain/types";
import {
  displayToKg,
  formatLoad,
  kgToDisplay,
  parseNumericInput,
  round,
} from "@/domain/units";
import { createExerciseDefinition, createWorkoutTemplate, saveWorkoutTemplate } from "@/lib/firebase/profile";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  PageHeader,
  SectionHeading,
} from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LoadMode = "none" | "numeric" | "descriptive";

interface EditorExercise {
  key: string;
  exerciseId: string;
  enabled: boolean;
  targetSets: string;
  targetReps: string;
  restSeconds: string;
  loadMode: LoadMode;
  loadValue: string;
  loadBasis: LoadBasis;
  loadLabel: string;
  progressionIncrement: string;
  note: string;
}

interface EditorState {
  name: string;
  type: WorkoutTemplate["type"];
  exercises: EditorExercise[];
}

const BASIS_OPTIONS: Array<{ value: LoadBasis; label: string }> = [
  { value: "total", label: "Total load" },
  { value: "perDumbbell", label: "Per dumbbell" },
  { value: "perSide", label: "Per side" },
  { value: "machine", label: "Machine / stack" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "unknown", label: "Other / unset" },
];

function displayNumber(kg: number | null, unit: "kg" | "lb"): string {
  if (kg === null) return "";
  return String(round(kgToDisplay(kg, unit), 2));
}

function toEditorExercise(
  exercise: TemplateExercise,
  unit: "kg" | "lb",
): EditorExercise {
  const load = exercise.defaultLoad;
  return {
    key: exercise.id,
    exerciseId: exercise.exerciseId,
    enabled: exercise.enabled,
    targetSets: String(exercise.targetSets),
    targetReps: String(exercise.targetReps),
    restSeconds: String(exercise.restSeconds),
    loadMode: !load
      ? "none"
      : load.kind === "numeric"
        ? "numeric"
        : "descriptive",
    loadValue:
      load?.kind === "numeric" ? displayNumber(load.kg, unit) : "",
    loadBasis:
      load?.kind === "numeric"
        ? load.basis
        : "unknown",
    loadLabel: load?.kind === "descriptive" ? load.label : "",
    progressionIncrement: displayNumber(
      exercise.progressionIncrementKg,
      unit,
    ),
    note: exercise.note,
  };
}

function newEditorExercise(
  definition: ExerciseDefinition,
  prefs: { defaultSets: number; defaultReps: number; defaultRestSeconds: number },
  unit: "kg" | "lb",
): EditorExercise {
  return {
    key: `te_${definition.id}_${Date.now()}`,
    exerciseId: definition.id,
    enabled: true,
    targetSets: String(prefs.defaultSets),
    targetReps: String(prefs.defaultReps),
    restSeconds: String(prefs.defaultRestSeconds),
    loadMode: "none",
    loadValue: "",
    loadBasis: "unknown",
    loadLabel: "",
    progressionIncrement: displayNumber(
      definition.defaultProgressionIncrementKg,
      unit,
    ),
    note: "",
  };
}

function parseInteger(
  raw: string,
  min: number,
  max: number,
): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

function editorLoadSummary(
  exercise: EditorExercise,
  unit: "kg" | "lb",
): string {
  if (exercise.loadMode === "descriptive") {
    return exercise.loadLabel.trim() || "Description not set";
  }
  if (exercise.loadMode === "numeric") {
    const parsed = parseNumericInput(exercise.loadValue);
    if (parsed === null) return "Weight not set";
    const basis =
      exercise.loadBasis === "perDumbbell" || exercise.loadBasis === "perSide"
        ? exercise.loadBasis
        : null;
    return formatLoad(
      {
        kind: "numeric",
        kg: displayToKg(parsed, unit),
        basis: exercise.loadBasis,
      },
      unit,
      { includeBasis: Boolean(basis) },
    );
  }
  return "Weight not set";
}

export function TemplateEditorClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const { user } = useAuth();
  const {
    templates,
    schedule,
    exerciseDefinitions,
    preferences,
    profile,
    loading,
  } = useUserData();
  const weightUnit = profile?.weightUnit ?? "kg";
  const [draft, setDraft] = React.useState<EditorState | null>(null);
  const [assignedDay, setAssignedDay] = React.useState<Weekday | "none">(
    "none",
  );
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newExercise, setNewExercise] = React.useState({
    name: "",
    category: "push" as ExerciseDefinition["category"],
    equipment: "",
    increment: "",
  });
  const initialisedRef = React.useRef<string | null>(null);
  const existing = id ? templates.find((template) => template.id === id) : null;

  React.useEffect(() => {
    if (loading || !profile || !preferences) return;
    const key = id ?? "__new";
    if (initialisedRef.current === key) return;
    if (id && !existing) return;

    if (existing) {
      setDraft({
        name: existing.name,
        type: existing.type,
        exercises: existing.exercises.map((exercise) =>
          toEditorExercise(exercise, profile.weightUnit),
        ),
      });
      const scheduled = schedule.find(
        (entry) => entry.templateId === existing.id,
      );
      setAssignedDay(scheduled?.day ?? "none");
      setExpanded(new Set());
    } else {
      setDraft({
        name: "",
        type: "strength",
        exercises: [],
      });
      setAssignedDay("none");
      setExpanded(new Set());
    }
    initialisedRef.current = key;
    setDirty(false);
  }, [
    id,
    existing,
    loading,
    profile,
    preferences,
    schedule,
  ]);

  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const definitionMap = React.useMemo(
    () =>
      new Map(
        exerciseDefinitions.map((definition) => [definition.id, definition]),
      ),
    [exerciseDefinitions],
  );

  const updateDraft = (updater: (current: EditorState) => EditorState) => {
    setDraft((current) => (current ? updater(current) : current));
    setDirty(true);
  };

  const updateExercise = (
    key: string,
    updates: Partial<EditorExercise>,
  ) => {
    updateDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.key === key ? { ...exercise, ...updates } : exercise,
      ),
    }));
  };

  const removeExercise = (key: string) => {
    updateDraft((current) => ({
      ...current,
      exercises: current.exercises.filter((exercise) => exercise.key !== key),
    }));
  };

  const moveExercise = (key: string, direction: -1 | 1) => {
    updateDraft((current) => {
      const index = current.exercises.findIndex(
        (exercise) => exercise.key === key,
      );
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.exercises.length) {
        return current;
      }
      const exercises = [...current.exercises];
      const [item] = exercises.splice(index, 1);
      exercises.splice(target, 0, item);
      return { ...current, exercises };
    });
  };

  const addDefinition = (definition: ExerciseDefinition) => {
    if (!preferences) return;
    if (
      draft?.exercises.some(
        (exercise) => exercise.exerciseId === definition.id,
      )
    ) {
      toast.info("That exercise is already in this template.");
      return;
    }
    const row = newEditorExercise(definition, preferences, weightUnit);
    updateDraft((current) => ({
      ...current,
      exercises: [...current.exercises, row],
    }));
    setExpanded((current) => new Set(current).add(row.key));
    setAddOpen(false);
    setSearch("");
    setShowCreate(false);
  };

  const createAndAddExercise = async () => {
    if (!user) return;
    if (!newExercise.name.trim()) {
      toast.error("Give the exercise a name.");
      return;
    }
    const increment = parseNumericInput(newExercise.increment);
    if (
      increment !== null &&
      (increment < 0 || increment > 1000)
    ) {
      toast.error("Progression increment is out of range.");
      return;
    }
    setCreating(true);
    try {
      const definition = await createExerciseDefinition(user.uid, {
        name: newExercise.name,
        category: newExercise.category,
        equipment: newExercise.equipment,
        defaultProgressionIncrementKg:
          increment === null
            ? null
            : round(displayToKg(increment, weightUnit), 2),
      });
      addDefinition(definition);
      setNewExercise({
        name: "",
        category: "push",
        equipment: "",
        increment: "",
      });
      toast.success(`${definition.name} added to your exercises.`);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not create the exercise.",
      );
    } finally {
      setCreating(false);
    }
  };

  const validateAndBuildExercises = (): TemplateExercise[] | null => {
    if (!draft) return null;
    if (!draft.name.trim()) {
      toast.error("Enter a workout name.");
      return null;
    }
    if (draft.name.trim().length > 80) {
      toast.error("Workout name must be 80 characters or fewer.");
      return null;
    }
    if (draft.type === "cardio") return [];
    const result: TemplateExercise[] = [];
    for (const [index, exercise] of draft.exercises.entries()) {
      const sets = parseInteger(exercise.targetSets, 1, 20);
      const reps = parseInteger(exercise.targetReps, 1, 100);
      const rest = parseInteger(exercise.restSeconds, 0, 3600);
      if (sets === null || reps === null) {
        setExpanded((current) => new Set(current).add(exercise.key));
        toast.error(
          `${definitionMap.get(exercise.exerciseId)?.name ?? "Exercise"}: sets must be 1–20 and reps 1–100.`,
        );
        return null;
      }
      if (rest === null) {
        setExpanded((current) => new Set(current).add(exercise.key));
        toast.error(
          `${definitionMap.get(exercise.exerciseId)?.name ?? "Exercise"}: rest must be 0–3600 seconds.`,
        );
        return null;
      }
      let defaultLoad: TemplateExercise["defaultLoad"] = null;
      if (exercise.loadMode === "descriptive") {
        if (!exercise.loadLabel.trim()) {
          setExpanded((current) => new Set(current).add(exercise.key));
          toast.error("Enter the descriptive load text, or choose a different load type.");
          return null;
        }
        defaultLoad = {
          kind: "descriptive",
          label: exercise.loadLabel.trim().slice(0, 120),
          numericEquivalentKg: null,
        };
      } else if (exercise.loadMode === "numeric") {
        const parsed = parseNumericInput(exercise.loadValue);
        if (parsed === null || parsed < 0 || parsed > 5000) {
          setExpanded((current) => new Set(current).add(exercise.key));
          toast.error("Enter a valid non-negative weight for every numeric load.");
          return null;
        }
        defaultLoad = {
          kind: "numeric",
          kg: round(displayToKg(parsed, weightUnit), 3),
          basis: exercise.loadBasis,
        };
      }
      const increment = parseNumericInput(exercise.progressionIncrement);
      if (increment !== null && (increment < 0 || increment > 1000)) {
        setExpanded((current) => new Set(current).add(exercise.key));
        toast.error("Progression increments must be between 0 and the allowed range.");
        return null;
      }
      result.push({
        id: exercise.key,
        exerciseId: exercise.exerciseId,
        order: index,
        targetSets: sets,
        targetReps: reps,
        defaultLoad,
        progressionIncrementKg:
          increment === null
            ? null
            : round(displayToKg(increment, weightUnit), 2),
        restSeconds: rest,
        note: exercise.note.trim().slice(0, 500),
        enabled: exercise.enabled,
      });
    }
    return result;
  };

  const handleSave = async () => {
    if (!user || !draft || !existing && id) return;
    const exercises = validateAndBuildExercises();
    if (!exercises) return;
    setSaving(true);
    try {
      if (existing) {
        await saveWorkoutTemplate(
          user.uid,
          {
            ...existing,
            name: draft.name,
            type: draft.type,
            exercises,
          },
          schedule,
          assignedDay,
        );
      } else {
        await createWorkoutTemplate(
          user.uid,
          {
            name: draft.name,
            type: draft.type,
            exercises,
            day: assignedDay,
          },
          exerciseDefinitions,
        );
      }
      setDirty(false);
      toast.success(existing ? "Template saved." : "Template created.");
      router.push("/workouts/?tab=templates");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not save the template.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-64 rounded-panel" />
        <div className="skeleton h-40 rounded-panel" />
      </div>
    );
  }

  if (id && !existing) {
    return (
      <EmptyState
        icon={<Layers className="size-5" />}
        title="Template not found"
        description="This workout may have been deleted, or the link is from an old copy."
        action={
          <Button asChild>
            <Link href="/workouts/?tab=templates">
              <ArrowLeft /> Back to templates
            </Link>
          </Button>
        }
      />
    );
  }

  if (!draft) return null;

  const assignedDayLabel =
    assignedDay === "none" ? "Not assigned" : WEEKDAY_LABELS[assignedDay];
  const selectedIds = new Set(
    draft.exercises.map((exercise) => exercise.exerciseId),
  );
  const filteredDefinitions = exerciseDefinitions
    .filter((definition) => !definition.isArchived)
    .filter((definition) =>
      definition.name.toLowerCase().includes(search.trim().toLowerCase()),
    );

  return (
    <div>
      <PageHeader
        eyebrow={existing ? "Edit template" : "New template"}
        title={existing ? existing.name : "Build a workout"}
        description="Templates define future sessions. Completed history keeps its own immutable snapshot."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/workouts/?tab=templates">
                <ArrowLeft /> Cancel
              </Link>
            </Button>
            <Button
              onClick={() => void handleSave()}
              loading={saving}
              disabled={dirty === false && Boolean(existing)}
            >
              <Save /> {existing ? "Save changes" : "Create template"}
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
              <div className="space-y-1.5">
                <Label htmlFor="template-name">Workout name</Label>
                <Input
                  id="template-name"
                  value={draft.name}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Push, Upper, Saturday Legs"
                  maxLength={80}
                  className="h-12 text-[15px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assign to day</Label>
                <Select
                  value={assignedDay}
                  onValueChange={(value) => {
                    setAssignedDay(value as Weekday | "none");
                    setDirty(true);
                  }}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No scheduled day</SelectItem>
                    {WEEKDAYS.map((day) => (
                      <SelectItem key={day} value={day}>
                        {WEEKDAY_LABELS[day]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-line/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updateDraft((current) => ({ ...current, type: "strength" }));
                  }}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[12px] font-medium transition-colors",
                    draft.type === "strength"
                      ? "border-lime/40 bg-lime/10 text-lime"
                      : "border-line bg-canvas-soft text-muted hover:text-ink",
                  )}
                >
                  <Dumbbell className="size-4" /> Strength
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateDraft((current) => ({ ...current, type: "cardio" }));
                  }}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[12px] font-medium transition-colors",
                    draft.type === "cardio"
                      ? "border-blue/40 bg-blue/10 text-blue"
                      : "border-line bg-canvas-soft text-muted hover:text-ink",
                  )}
                >
                  <HeartPulse className="size-4" /> Cardio
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-2">
                Scheduled: <span className="text-muted">{assignedDayLabel}</span>
                {" · "}
                {existing
                  ? `Version ${existing.version}`
                  : "One template per weekday."}
              </p>
            </div>
          </Card>

          {draft.type === "cardio" ? (
            <Card className="border-blue/20 bg-blue/[0.035] p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue/20 bg-blue/10 text-blue">
                  <HeartPulse className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Cardio has its own logger
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    Duration, distance, pace, incline, speed, equipment, and
                    intensity are logged independently. Exercise rows are not
                    used for a cardio template and will not be saved.
                  </p>
                  {draft.exercises.length > 0 ? (
                    <p className="mt-2 text-[11px] text-warning">
                      {draft.exercises.length} strength exercise row
                      {draft.exercises.length === 1 ? "" : "s"} will be removed
                      when you save this as cardio.
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex items-end justify-between gap-4">
                <SectionHeading
                  title="Exercises"
                  description="Order, load type, target sets and reps are all editable."
                  className="mb-0"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAddOpen(true);
                    setShowCreate(false);
                    setSearch("");
                  }}
                >
                  <Plus /> Add exercise
                </Button>
              </div>

              {draft.exercises.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Dumbbell className="size-5" />}
                  title="No exercises yet"
                  description="Add from your seeded exercise library, or create a custom movement."
                  action={
                    <Button
                      onClick={() => {
                        setAddOpen(true);
                        setShowCreate(false);
                      }}
                    >
                      <Plus /> Add exercise
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {draft.exercises.map((exercise, index) => {
                    const definition = definitionMap.get(exercise.exerciseId);
                    const isOpen = expanded.has(exercise.key);
                    const loadSummary = editorLoadSummary(exercise, weightUnit);
                    return (
                      <Card
                        key={exercise.key}
                        className={cn(
                          "overflow-hidden",
                          !exercise.enabled && "opacity-60",
                        )}
                      >
                        <div className="flex items-center gap-2 p-3 sm:gap-3">
                          <GripVertical className="hidden size-4 shrink-0 text-muted-2/50 sm:block" />
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated text-[10px] font-semibold text-muted-2">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() =>
                                setExpanded((current) => {
                                  const next = new Set(current);
                                  if (next.has(exercise.key)) {
                                    next.delete(exercise.key);
                                  } else {
                                    next.add(exercise.key);
                                  }
                                  return next;
                                })
                              }
                            >
                              <p className="truncate text-[13px] font-semibold text-ink">
                                {definition?.name ?? "Missing exercise"}
                                {!exercise.enabled ? (
                                  <span className="ml-2 text-[9px] font-medium uppercase tracking-[0.1em] text-muted-2">
                                    off
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-muted-2">
                                {exercise.targetSets} × {exercise.targetReps} ·{" "}
                                {loadSummary} · {exercise.restSeconds}s rest
                              </p>
                            </button>
                          </div>
                          <div className="flex shrink-0 items-center">
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => moveExercise(exercise.key, -1)}
                              disabled={index === 0}
                              aria-label="Move exercise up"
                            >
                              <ChevronUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => moveExercise(exercise.key, 1)}
                              disabled={index === draft.exercises.length - 1}
                              aria-label="Move exercise down"
                            >
                              <ChevronDown />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-muted-2 hover:text-danger"
                              onClick={() => removeExercise(exercise.key)}
                              aria-label="Remove exercise"
                            >
                              <X />
                            </Button>
                          </div>
                        </div>

                        {isOpen ? (
                          <div className="border-t border-line/60 bg-canvas-soft/35 p-4 sm:pl-[3.9rem]">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <div className="space-y-1">
                                <Label className="text-[10px]">Target sets</Label>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={20}
                                  value={exercise.targetSets}
                                  onChange={(event) =>
                                    updateExercise(exercise.key, {
                                      targetSets: event.target.value,
                                    })
                                  }
                                  className="h-10 text-center"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">Target reps</Label>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={100}
                                  value={exercise.targetReps}
                                  onChange={(event) =>
                                    updateExercise(exercise.key, {
                                      targetReps: event.target.value,
                                    })
                                  }
                                  className="h-10 text-center"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">Rest (sec)</Label>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={3600}
                                  value={exercise.restSeconds}
                                  onChange={(event) =>
                                    updateExercise(exercise.key, {
                                      restSeconds: event.target.value,
                                    })
                                  }
                                  className="h-10 text-center"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">Enabled</Label>
                                <div className="flex h-10 items-center justify-center rounded-xl border border-line bg-surface">
                                  <Switch
                                    checked={exercise.enabled}
                                    onCheckedChange={(enabled) =>
                                      updateExercise(exercise.key, { enabled })
                                    }
                                    aria-label="Exercise enabled"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-[10px]">Default load</Label>
                                <Select
                                  value={exercise.loadMode}
                                  onValueChange={(value) =>
                                    updateExercise(exercise.key, {
                                      loadMode: value as LoadMode,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-10 bg-surface text-[12px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Not set</SelectItem>
                                    <SelectItem value="numeric">
                                      Numeric weight
                                    </SelectItem>
                                    <SelectItem value="descriptive">
                                      Descriptive load
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {exercise.loadMode === "numeric" ? (
                                <div className="space-y-1.5">
                                  <Label className="text-[10px]">
                                    Working weight ({weightUnit})
                                  </Label>
                                  <div className="flex gap-2">
                                    <Input
                                      inputMode="decimal"
                                      value={exercise.loadValue}
                                      onChange={(event) =>
                                        updateExercise(exercise.key, {
                                          loadValue: event.target.value,
                                        })
                                      }
                                      placeholder="e.g. 35"
                                      className="h-10 bg-surface"
                                    />
                                    <Select
                                      value={exercise.loadBasis}
                                      onValueChange={(value) =>
                                        updateExercise(exercise.key, {
                                          loadBasis: value as LoadBasis,
                                        })
                                      }
                                    >
                                      <SelectTrigger
                                        className="h-10 w-[135px] shrink-0 bg-surface text-[11px]"
                                        aria-label="Load basis"
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {BASIS_OPTIONS.map((option) => (
                                          <SelectItem
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              ) : exercise.loadMode === "descriptive" ? (
                                <div className="space-y-1.5">
                                  <Label className="text-[10px]">
                                    Exact load description
                                  </Label>
                                  <Input
                                    value={exercise.loadLabel}
                                    onChange={(event) =>
                                      updateExercise(exercise.key, {
                                        loadLabel: event.target.value,
                                      })
                                    }
                                    placeholder="e.g. Full stack + 15 kg"
                                    maxLength={120}
                                    className="h-10 bg-surface"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-end">
                                  <p className="pb-2 text-[10px] leading-relaxed text-muted-2">
                                    Log the actual weight when you train. No
                                    weight is assumed.
                                  </p>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <Label className="text-[10px]">
                                  Progression increment ({weightUnit})
                                </Label>
                                <Input
                                  inputMode="decimal"
                                  value={exercise.progressionIncrement}
                                  onChange={(event) =>
                                    updateExercise(exercise.key, {
                                      progressionIncrement: event.target.value,
                                    })
                                  }
                                  placeholder="Optional"
                                  className="h-10 bg-surface"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px]">
                                  Exercise note
                                </Label>
                                <Input
                                  value={exercise.note}
                                  onChange={(event) =>
                                    updateExercise(exercise.key, {
                                      note: event.target.value,
                                    })
                                  }
                                  placeholder="Setup, seat height, cue…"
                                  maxLength={500}
                                  className="h-10 bg-surface"
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-line/70 bg-surface/60 px-3 py-2 text-[10px] leading-relaxed text-muted-2">
                              <Info className="mt-0.5 size-3 shrink-0" />
                              Descriptive loads such as “Full stack + 15 kg”
                              remain text. FORGE never converts them into a
                              numeric weight.
                            </div>
                          </div>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-[12px] font-semibold text-ink">Template summary</p>
            <div className="mt-3 space-y-2 border-t border-line/60 pt-3 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Type</span>
                <span className="font-medium text-ink">
                  {draft.type === "strength" ? "Strength" : "Cardio"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Exercises</span>
                <span className="tabular font-medium text-ink">
                  {draft.type === "cardio"
                    ? "—"
                    : draft.exercises.filter((exercise) => exercise.enabled)
                        .length}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Target sets</span>
                <span className="tabular font-medium text-ink">
                  {draft.type === "cardio"
                    ? "—"
                    : draft.exercises
                        .filter((exercise) => exercise.enabled)
                        .reduce((total, exercise) => {
                          const sets = Number(exercise.targetSets);
                          return Number.isFinite(sets) ? total + sets : total;
                        }, 0)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Scheduled</span>
                <span className="font-medium text-ink">{assignedDayLabel}</span>
              </div>
            </div>
          </Card>
          <div className="rounded-2xl border border-line bg-surface/60 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-ink">
              <Info className="size-3.5 text-lime" /> History stays fixed
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
              Changes here affect future sessions only. Previously completed
              workouts retain their original exercise names, loads, and sets.
            </p>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!dirty && Boolean(existing)}
          >
            <Save /> {existing ? "Save changes" : "Create template"}
          </Button>
        </aside>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Add an exercise</DialogTitle>
            <DialogDescription>
              Pick from your exercise library or create a new movement. Loads
              are set on the template, not invented from history.
            </DialogDescription>
          </DialogHeader>

          {!showCreate ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search exercises…"
                  className="pl-10"
                  autoFocus
                />
              </div>
              <div className="mt-3 max-h-[42dvh] overflow-y-auto rounded-xl border border-line bg-canvas-soft/45 p-1">
                {filteredDefinitions.length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs text-muted">
                    No matching exercises.
                  </p>
                ) : (
                  filteredDefinitions.map((definition) => {
                    const added = selectedIds.has(definition.id);
                    return (
                      <button
                        key={definition.id}
                        type="button"
                        onClick={() => addDefinition(definition)}
                        disabled={added}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-elevated disabled:opacity-50"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted-2">
                          {definition.category === "core" ? (
                            <Layers className="size-3.5" />
                          ) : (
                            <Dumbbell className="size-3.5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-ink">
                            {definition.name}
                          </span>
                          <span className="block truncate text-[10px] text-muted-2">
                            {definition.equipment || definition.category}
                          </span>
                        </span>
                        {added ? (
                          <Check className="size-4 text-lime" />
                        ) : (
                          <Plus className="size-4 text-muted-2" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus /> Create new exercise
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-exercise-name">Exercise name</Label>
                  <Input
                    id="new-exercise-name"
                    value={newExercise.name}
                    onChange={(event) =>
                      setNewExercise((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Cable Lateral Raise"
                    maxLength={120}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      value={newExercise.category}
                      onValueChange={(value) =>
                        setNewExercise((current) => ({
                          ...current,
                          category: value as ExerciseDefinition["category"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["push", "pull", "legs", "core", "cardio", "other"].map(
                          (category) => (
                            <SelectItem key={category} value={category}>
                              {category[0].toUpperCase() + category.slice(1)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-equipment">Equipment</Label>
                    <Input
                      id="new-equipment"
                      value={newExercise.equipment}
                      onChange={(event) =>
                        setNewExercise((current) => ({
                          ...current,
                          equipment: event.target.value,
                        }))
                      }
                      placeholder="e.g. Cable"
                      maxLength={120}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-increment">
                    Default progression increment ({weightUnit}, optional)
                  </Label>
                  <Input
                    id="new-increment"
                    inputMode="decimal"
                    value={newExercise.increment}
                    onChange={(event) =>
                      setNewExercise((current) => ({
                        ...current,
                        increment: event.target.value,
                      }))
                    }
                    placeholder="e.g. 2.5"
                  />
                  <FieldError />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setShowCreate(false)}>
                  Back to library
                </Button>
                <Button
                  onClick={() => void createAndAddExercise()}
                  loading={creating}
                >
                  Create & add
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
