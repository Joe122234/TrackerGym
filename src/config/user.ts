/**
 * FORGE is deliberately a single-person training log. There is no account
 * system and no per-device identity: every device reads and writes the same
 * Firestore namespace below `users/{SHARED_LOG_ID}`.
 *
 * This namespace is intentionally public. Anyone who has the app link can read
 * or change the log, which is the trade-off for seamless cross-device sync
 * without a login.
 */
export const SHARED_LOG_ID = "shared";

export const SINGLE_USER = {
  displayName: "Henry",
  heightCm: 172,
  weightKg: 70,
  weightUnit: "kg",
  measurementUnit: "cm",
  timezone: "Asia/Bangkok",
} as const;
