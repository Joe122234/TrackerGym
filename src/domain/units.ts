import type {
  LoadPrescription,
  MeasurementUnit,
  WeightUnit,
} from "./types";

export const KG_PER_LB = 0.45359237;

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : kg / KG_PER_LB;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : value * KG_PER_LB;
}

export function cmToDisplay(cm: number, unit: MeasurementUnit): number {
  return unit === "cm" ? cm : cm / 2.54;
}

export function displayToCm(value: number, unit: MeasurementUnit): number {
  return unit === "cm" ? value : value * 2.54;
}

function compactNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatWeight(
  kg: number | null,
  unit: WeightUnit,
  options: { withUnit?: boolean; includeBasis?: "perDumbbell" | "perSide" | null } = {},
): string {
  if (kg === null) return "Not set";
  const { withUnit = true, includeBasis = null } = options;
  const value = compactNumber(kgToDisplay(kg, unit));
  const base = withUnit ? `${value} ${unit}` : value;
  if (includeBasis === "perDumbbell") return `${base} / dumbbell`;
  if (includeBasis === "perSide") return `${base} / side`;
  return base;
}

export function formatLoad(
  load: LoadPrescription,
  unit: WeightUnit,
  options: { includeBasis?: boolean } = {},
): string {
  if (!load) return "Weight not set";
  if (load.kind === "descriptive") {
    return load.label;
  }
  return formatWeight(load.kg, unit, {
    includeBasis:
      options.includeBasis === false
        ? null
        : load.basis === "perDumbbell"
          ? "perDumbbell"
          : load.basis === "perSide"
            ? "perSide"
            : null,
  });
}

export function formatVolume(kgReps: number, unit: WeightUnit): string {
  const value = kgToDisplay(kgReps, unit);
  if (value >= 1_000_000) {
    return `${compactNumber(value / 1_000_000, 1)}M ${unit}·reps`;
  }
  if (value >= 1000) {
    return `${compactNumber(value / 1000, 1)}k ${unit}·reps`;
  }
  return `${compactNumber(value, 0)} ${unit}·reps`;
}

export function formatMeasure(
  cm: number | null,
  unit: MeasurementUnit,
  label?: string,
): string {
  if (cm === null) return "Not set";
  const value = compactNumber(cmToDisplay(cm, unit), 1);
  return label ? `${label}: ${value} ${unit}` : `${value} ${unit}`;
}

export function formatDeltaWeight(deltaKg: number, unit: WeightUnit): string {
  const value = kgToDisplay(deltaKg, unit);
  const sign = value > 0 ? "+" : "";
  return `${sign}${compactNumber(value, 1)} ${unit}`;
}

export function parseNumericInput(raw: string): number | null {
  const clean = raw.trim().replace(",", ".");
  if (clean === "") return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

export function round(value: number, decimals = 1): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  const sign = value < 0 ? -1 : 1;
  return (
    (sign * Math.round((Math.abs(value) + Number.EPSILON) * factor)) / factor
  );
}

export function weightPrescriptionLabel(
  load: LoadPrescription,
  targetSets: number,
  targetReps: number,
  unit: WeightUnit,
): string {
  const target = `${targetSets} × ${targetReps}`;
  if (!load) return `Weight not set · ${target}`;
  return `${formatLoad(load, unit)} · ${target}`;
}

export function secondsToPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm)) return "—";
  const safe = Math.max(0, Math.round(secondsPerKm));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
}
