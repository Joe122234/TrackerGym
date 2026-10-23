"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  LineChart as LineChartIcon,
  Plus,
  Ruler,
  Scale,
  Trash2,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { BodyMeasurement, MeasurementUnit, WeightUnit } from "@/domain/types";
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  formatMeasure,
  formatWeight,
  kgToDisplay,
  parseNumericInput,
  round,
} from "@/domain/units";
import { formatDateKey, todayKey } from "@/domain/dates";
import {
  deleteMeasurement,
  upsertMeasurement,
} from "@/lib/firebase/measurements";
import { updateProfile } from "@/lib/firebase/profile";
import { useAuth } from "@/hooks/use-auth";
import { useMeasurements } from "@/hooks/use-measurements";
import { useUserData } from "@/hooks/use-user-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import {
  EmptyState,
  PageHeader,
  SectionHeading,
  StatTile,
} from "@/components/ui/layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BUILT_INS = [
  { metric: "bodyWeight", label: "Body weight", unit: "kg" as const },
  { metric: "waist", label: "Waist", unit: "cm" as const },
  { metric: "chest", label: "Chest", unit: "cm" as const },
  { metric: "hips", label: "Hips", unit: "cm" as const },
  { metric: "neck", label: "Neck", unit: "cm" as const },
  { metric: "shoulders", label: "Shoulders", unit: "cm" as const },
  { metric: "leftArm", label: "Left arm", unit: "cm" as const },
  { metric: "rightArm", label: "Right arm", unit: "cm" as const },
  { metric: "leftThigh", label: "Left thigh", unit: "cm" as const },
  { metric: "rightThigh", label: "Right thigh", unit: "cm" as const },
];

const METRIC_LABELS: Record<string, string> = Object.fromEntries(
  BUILT_INS.map((entry) => [entry.metric, entry.label]),
);

function displayValue(
  measurement: BodyMeasurement,
  weightUnit: WeightUnit,
  measurementUnit: MeasurementUnit,
): string {
  if (measurement.unit === "kg") {
    return formatWeight(measurement.value, weightUnit);
  }
  return formatMeasure(measurement.value, measurementUnit);
}

function deltaText(
  value: number,
  previous: number,
  unit: "kg" | "cm",
  weightUnit: WeightUnit,
  measurementUnit: MeasurementUnit,
): { text: string; direction: "up" | "down" | "same" } {
  const displayed =
    unit === "kg"
      ? kgToDisplay(value - previous, weightUnit)
      : cmToDisplay(value - previous, measurementUnit);
  const safe = round(displayed, 1);
  if (Math.abs(safe) < 0.05) {
    return { text: "No change", direction: "same" };
  }
  return {
    text: `${safe > 0 ? "+" : ""}${safe} ${unit === "kg" ? weightUnit : measurementUnit}`,
    direction: safe > 0 ? "up" : "down",
  };
}

export function BodyClient() {
  const { user } = useAuth();
  const { profile } = useUserData();
  const { measurements, loading, error } = useMeasurements();
  const [now] = React.useState(() => Date.now());
  const timezone = profile?.timezone ?? "Asia/Bangkok";
  const today = todayKey(timezone, now);
  const weightUnit = profile?.weightUnit ?? "kg";
  const measurementUnit = profile?.measurementUnit ?? "cm";
  const [addOpen, setAddOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [metric, setMetric] = React.useState("bodyWeight");
  const [customLabel, setCustomLabel] = React.useState("");
  const [customUnit, setCustomUnit] = React.useState<"kg" | "cm">("cm");
  const [date, setDate] = React.useState(today);
  const [valueInput, setValueInput] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<BodyMeasurement | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);

  const bodyWeights = React.useMemo(
    () =>
      measurements
        .filter((measurement) => measurement.metric === "bodyWeight")
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    [measurements],
  );
  const latestWeight = bodyWeights.at(-1) ?? null;
  const firstWeight = bodyWeights[0] ?? null;
  const weightChange =
    latestWeight && firstWeight && latestWeight.id !== firstWeight.id
      ? deltaText(
          latestWeight.value,
          firstWeight.value,
          "kg",
          weightUnit,
          measurementUnit,
        )
      : null;

  const chartData = React.useMemo(
    () =>
      bodyWeights.map((measurement) => ({
        date: formatDateKey(measurement.date, "MMM d"),
        weight: round(kgToDisplay(measurement.value, weightUnit), 1),
      })),
    [bodyWeights, weightUnit],
  );

  const latestByMetric = React.useMemo(() => {
    const map = new Map<string, { latest: BodyMeasurement; previous?: BodyMeasurement }>();
    for (const measurement of measurements) {
      const current = map.get(measurement.metric);
      if (!current) {
        map.set(measurement.metric, { latest: measurement });
      } else if (!current.previous) {
        current.previous = measurement;
      }
    }
    return [...map.values()];
  }, [measurements]);

  const resetForm = () => {
    setMetric("bodyWeight");
    setCustomLabel("");
    setCustomUnit("cm");
    setDate(today);
    setValueInput("");
    setNotes("");
    setFormError(null);
  };

  const openAdd = () => {
    resetForm();
    setAddOpen(true);
  };

  const selectedBuiltIn = BUILT_INS.find((entry) => entry.metric === metric);
  const selectedUnit = metric === "custom" ? customUnit : selectedBuiltIn?.unit ?? "cm";
  const inputUnit =
    selectedUnit === "kg" ? weightUnit : measurementUnit;

  const handleSave = async () => {
    if (!user || !profile) return;
    const parsed = parseNumericInput(valueInput);
    if (parsed === null || parsed <= 0 || parsed > 10000) {
      setFormError(`Enter a valid measurement in ${inputUnit}.`);
      return;
    }
    if (metric === "custom" && !customLabel.trim()) {
      setFormError("Give this custom measurement a name.");
      return;
    }
    if (!date) {
      setFormError("Choose a measurement date.");
      return;
    }
    if (date > today) {
      setFormError("Measurements cannot be dated in the future.");
      return;
    }
    const canonicalValue =
      selectedUnit === "kg"
        ? round(displayToKg(parsed, weightUnit), 3)
        : round(displayToCm(parsed, measurementUnit), 2);
    const label =
      metric === "custom"
        ? customLabel.trim().slice(0, 80)
        : selectedBuiltIn?.label ?? "Measurement";
    const metricKey =
      metric === "custom"
        ? `custom:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "measurement"}`
        : metric;
    setSaving(true);
    setFormError(null);
    try {
      await upsertMeasurement(user.uid, {
        metric: metricKey,
        label,
        date,
        value: canonicalValue,
        unit: selectedUnit,
        notes,
        isCustom: metric === "custom",
      });
      if (metric === "bodyWeight" && date === today) {
        await updateProfile(user.uid, {
          displayName: profile.displayName,
          heightCm: profile.heightCm,
          weightKg: canonicalValue,
          weightUnit: profile.weightUnit,
          measurementUnit: profile.measurementUnit,
          timezone: profile.timezone,
        });
      }
      toast.success("Measurement saved.");
      setAddOpen(false);
      resetForm();
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : "Could not save the measurement.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMeasurement(user.uid, deleteTarget.id);
      toast.success("Measurement deleted.");
      setDeleteTarget(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not delete the measurement.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const latestWaist = latestByMetric.find(
    (entry) => entry.latest.metric === "waist",
  );

  return (
    <div>
      <PageHeader
        eyebrow="Body"
        title="Measurements"
        description="Track the body, not just the bar. Ages, deltas, and charts are computed only from entries you add."
        actions={
          <Button onClick={openAdd}>
            <Plus /> Log measurement
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Body weight"
          value={
            latestWeight
              ? formatWeight(latestWeight.value, weightUnit)
              : "—"
          }
          hint={
            latestWeight
              ? formatDateKey(latestWeight.date, "MMM d, yyyy")
              : "No measurement yet"
          }
          icon={<Scale className="size-4" />}
          accent="lime"
        />
        <StatTile
          label="Change"
          value={weightChange?.text ?? "—"}
          hint={
            weightChange
              ? "Latest vs first recorded"
              : "Log at least two weights"
          }
          icon={
            weightChange?.direction === "down" ? (
              <ArrowDownRight className="size-4" />
            ) : (
              <ArrowUpRight className="size-4" />
            )
          }
        />
        <StatTile
          label="Waist"
          value={
            latestWaist
              ? displayValue(
                  latestWaist.latest,
                  weightUnit,
                  measurementUnit,
                ).split(" ")[0]
              : "—"
          }
          hint={
            latestWaist
              ? `${measurementUnit} · ${formatDateKey(latestWaist.latest.date, "MMM d")}`
              : "Not recorded"
          }
          icon={<Ruler className="size-4" />}
          accent="violet"
        />
        <StatTile
          label="Entries"
          value={measurements.length}
          hint={`${latestByMetric.length} tracked metrics`}
          icon={<CalendarDays className="size-4" />}
          accent="blue"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <LineChartIcon className="size-4 text-muted-2" /> Body weight
              </h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Every recorded weigh-in in {weightUnit}
              </p>
            </div>
            {latestWeight ? (
              <Badge variant="lime">
                {formatWeight(latestWeight.value, weightUnit)}
              </Badge>
            ) : null}
          </div>
          {loading ? (
            <div className="skeleton mt-4 h-56 rounded-xl" />
          ) : chartData.length === 0 ? (
            <div className="mt-4 flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-canvas-soft/30 px-6 text-center">
              <Scale className="size-5 text-muted-2" />
              <p className="mt-2 text-sm text-muted">
                No body weight entries yet.
              </p>
              <Button className="mt-3" size="sm" variant="secondary" onClick={openAdd}>
                Log the first one
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-4 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="#242a31"
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#7d8794", fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fill: "#69737f", fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      domain={["dataMin - 1", "dataMax + 1"]}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#14181d",
                        border: "1px solid #2a3038",
                        borderRadius: 12,
                        fontSize: 11,
                        color: "#eef1f4",
                      }}
                      labelStyle={{ color: "#9aa4b1", marginBottom: 4 }}
                      formatter={(value) => [
                        `${Number(value)} ${weightUnit}`,
                        "Body weight",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#C5F467"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#C5F467", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#C5F467", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[10px] text-muted-2">
                {bodyWeights.length} weigh-in
                {bodyWeights.length === 1 ? "" : "s"} · stored in kg, shown in{" "}
                {weightUnit}
              </p>
            </>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink">Tracked metrics</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Latest entry and change
          </p>
          {latestByMetric.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-line bg-canvas-soft/30 px-4 py-8 text-center text-[11px] leading-relaxed text-muted">
              Add a measurement to start tracking trends over time.
            </p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {latestByMetric.map(({ latest, previous }) => {
                const delta =
                  previous &&
                  deltaText(
                    latest.value,
                    previous.value,
                    latest.unit,
                    weightUnit,
                    measurementUnit,
                  );
                return (
                  <div
                    key={latest.metric}
                    className="flex items-center gap-2.5 rounded-xl border border-line/60 bg-canvas-soft/30 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-ink">
                        {latest.label}
                      </p>
                      <p className="text-[9px] text-muted-2">
                        {formatDateKey(latest.date, "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-[11px] font-semibold text-ink">
                        {displayValue(latest, weightUnit, measurementUnit)}
                      </p>
                      {delta ? (
                        <p
                          className={cn(
                            "tabular text-[9px]",
                            delta.direction === "up"
                              ? "text-warning"
                              : delta.direction === "down"
                                ? "text-success"
                                : "text-muted-2",
                          )}
                        >
                          {delta.text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-7">
        <SectionHeading
          title="Measurement history"
          description="All entries, newest first. Canonical values stay in kg and cm."
        />
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            compact
            icon={<Ruler className="size-5" />}
            title="Measurements unavailable"
            description={error}
          />
        ) : measurements.length === 0 ? (
          <EmptyState
            compact
            icon={<Ruler className="size-5" />}
            title="No measurements yet"
            description="Your body log starts when you record the first measurement. Nothing is inferred or pre-filled."
            action={
              <Button onClick={openAdd}>
                <Plus /> Log measurement
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line bg-surface">
            {measurements.map((measurement) => (
              <div
                key={measurement.id}
                className="flex items-center gap-3 border-b border-line/60 p-4 last:border-b-0"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated text-muted-2">
                  {measurement.unit === "kg" ? (
                    <Scale className="size-4" />
                  ) : (
                    <Ruler className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[12px] font-semibold text-ink">
                      {measurement.label || METRIC_LABELS[measurement.metric] || measurement.metric}
                    </p>
                    {measurement.isCustom ? (
                      <Badge variant="outline">Custom</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-2">
                    {formatDateKey(measurement.date, "EEEE, MMM d, yyyy")}
                    {measurement.notes ? ` · ${measurement.notes}` : ""}
                  </p>
                </div>
                <p className="tabular shrink-0 text-[12px] font-semibold text-ink">
                  {displayValue(measurement, weightUnit, measurementUnit)}
                </p>
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={() => setDeleteTarget(measurement)}
                  aria-label={`Delete ${measurement.label} measurement`}
                  className="text-muted-2 hover:text-danger"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-panel border border-line bg-surface/55 p-4">
        <p className="text-[11px] leading-relaxed text-muted-2">
          Display units follow Settings. Existing records are not rewritten when
          you switch units.
        </p>
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!saving) setAddOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a measurement</DialogTitle>
            <DialogDescription>
              Only the value you enter is stored. Negative changes are shown,
              never hidden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Metric</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUILT_INS.map((entry) => (
                    <SelectItem key={entry.metric} value={entry.metric}>
                      {entry.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom measurement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {metric === "custom" ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                <div className="space-y-1.5">
                  <Label htmlFor="custom-label">Name</Label>
                  <Input
                    id="custom-label"
                    value={customLabel}
                    onChange={(event) => setCustomLabel(event.target.value)}
                    placeholder="e.g. Calves"
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Select
                    value={customUnit}
                    onValueChange={(value) =>
                      setCustomUnit(value as "kg" | "cm")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm">Length (cm)</SelectItem>
                      <SelectItem value="kg">Weight (kg)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="measurement-value">
                  Value ({inputUnit})
                </Label>
                <Input
                  id="measurement-value"
                  inputMode="decimal"
                  value={valueInput}
                  onChange={(event) => {
                    setValueInput(event.target.value);
                    setFormError(null);
                  }}
                  placeholder="0.0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="measurement-date">Date</Label>
                <Input
                  id="measurement-date"
                  type="date"
                  value={date}
                  max={today}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="measurement-notes">Notes (optional)</Label>
              <Textarea
                id="measurement-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Morning, fasted, same tape position…"
                rows={3}
                maxLength={1000}
                className="min-h-20"
              />
            </div>
            <FieldError>{formError}</FieldError>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setAddOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} loading={saving}>
              <Plus /> Save measurement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this measurement?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.label} from ${formatDateKey(deleteTarget.date, "MMMM d, yyyy")} will be removed.`
                : ""}{" "}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
