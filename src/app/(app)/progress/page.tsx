import type { Metadata } from "next";
import { ProgressClient } from "./progress-client";

export const metadata: Metadata = {
  title: "Progress",
  description:
    "Real consistency, volume, personal records, and achievements from completed workouts.",
};

export default function ProgressPage() {
  return <ProgressClient />;
}
