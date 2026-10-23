/**
 * FORGE is deliberately a single-person training log. There is no account
 * picker and no visible authentication flow; the app creates a private
 * anonymous Firebase session on this device and seeds this profile once.
 */
export const SINGLE_USER = {
  displayName: "Henry",
  heightCm: 172,
  weightKg: 70,
  weightUnit: "kg",
  measurementUnit: "cm",
  timezone: "Asia/Bangkok",
} as const;
