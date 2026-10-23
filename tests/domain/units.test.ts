import { describe, expect, it } from "vitest";
import {
  KG_PER_LB,
  cmToDisplay,
  displayToCm,
  displayToKg,
  formatDeltaWeight,
  formatLoad,
  formatMeasure,
  formatVolume,
  formatWeight,
  kgToDisplay,
  parseNumericInput,
  round,
  secondsToPace,
} from "@/domain/units";

describe("unit conversion", () => {
  it("round-trips kilograms through pounds", () => {
    const pounds = kgToDisplay(100, "lb");
    expect(pounds).toBeCloseTo(100 / KG_PER_LB, 8);
    expect(displayToKg(pounds, "lb")).toBeCloseTo(100, 8);
    expect(displayToKg(100, "kg")).toBe(100);
  });

  it("round-trips centimeters through inches", () => {
    const inches = cmToDisplay(180, "in");
    expect(inches).toBeCloseTo(70.866, 3);
    expect(displayToCm(inches, "in")).toBeCloseTo(180, 8);
  });

  it("parses decimal commas and rejects empty or invalid values", () => {
    expect(parseNumericInput(" 82,5 ")).toBe(82.5);
    expect(parseNumericInput("0.25")).toBe(0.25);
    expect(parseNumericInput("")).toBeNull();
    expect(parseNumericInput("abc")).toBeNull();
    expect(parseNumericInput("Infinity")).toBeNull();
  });

  it("rounds without relying on binary floating-point display", () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(99.994, 1)).toBe(100);
  });
});

describe("training display", () => {
  it("formats weights in the selected display unit", () => {
    expect(formatWeight(100, "kg")).toBe("100 kg");
    expect(formatWeight(100, "lb")).toBe("220.46 lb");
    expect(formatWeight(null, "kg")).toBe("Not set");
  });

  it("preserves a per-dumbbell basis", () => {
    expect(
      formatWeight(35, "kg", { includeBasis: "perDumbbell" }),
    ).toBe("35 kg / dumbbell");
  });

  it("renders descriptive loads exactly instead of inventing numbers", () => {
    expect(
      formatLoad(
        {
          kind: "descriptive",
          label: "Full stack + 15 kg",
          numericEquivalentKg: null,
        },
        "kg",
      ),
    ).toBe("Full stack + 15 kg");
  });

  it("adds a per-side label only to numeric sides", () => {
    expect(
      formatLoad(
        { kind: "numeric", kg: 40, basis: "perSide" },
        "kg",
      ),
    ).toBe("40 kg / side");
  });

  it("formats volume compactly and in canonical-display units", () => {
    expect(formatVolume(12_500, "kg")).toBe("12.5k kg·reps");
    expect(formatVolume(950, "kg")).toBe("950 kg·reps");
    expect(formatVolume(100, "lb")).toBe("220 lb·reps");
  });

  it("formats body measurements", () => {
    expect(formatMeasure(80, "cm")).toBe("80 cm");
    expect(formatMeasure(80, "cm", "Waist")).toBe("Waist: 80 cm");
    expect(formatMeasure(null, "cm")).toBe("Not set");
  });

  it("formats signed weight deltas", () => {
    expect(formatDeltaWeight(2.5, "kg")).toBe("+2.5 kg");
    expect(formatDeltaWeight(-2.5, "kg")).toBe("-2.5 kg");
  });

  it("formats pace and handles missing values", () => {
    expect(secondsToPace(330)).toBe("5:30 /km");
    expect(secondsToPace(null)).toBe("—");
    expect(secondsToPace(Number.NaN)).toBe("—");
  });
});
