import type { PersonalRecord, WeightUnit } from "@/domain/types";
import { formatVolume, formatWeight } from "@/domain/units";
import { prMetricLabel } from "@/domain/records";

export function formatRecordValue(
  record: PersonalRecord,
  weightUnit: WeightUnit,
): string {
  switch (record.metric) {
    case "maxWeight":
    case "estimated1RM":
      return formatWeight(record.value, weightUnit);
    case "repsAtWeight": {
      const weight =
        record.weightKg === null
          ? null
          : formatWeight(record.weightKg, weightUnit, {
              includeBasis:
                record.loadBasis === "perDumbbell"
                  ? "perDumbbell"
                  : record.loadBasis === "perSide"
                    ? "perSide"
                    : null,
            });
      return weight ? `${record.value} reps @ ${weight}` : `${record.value} reps`;
    }
    case "exerciseVolume":
    case "sessionVolume":
      return formatVolume(record.value, weightUnit);
    case "targetPerformance":
      return `${record.value} reps`;
    default:
      return String(record.value);
  }
}

export function formatRecordSecondary(
  record: PersonalRecord,
  weightUnit: WeightUnit,
): string {
  const label = prMetricLabel(record.metric);
  if (record.previousValue === null) return `${label} · first mark`;
  const previous = { ...record, value: record.previousValue };
  return `${label} · previous ${formatRecordValue(previous, weightUnit)}`;
}
