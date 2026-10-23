import type { Metadata } from "next";
import { ActiveWorkoutClient } from "./workout-client";

export const metadata: Metadata = {
  title: "Active workout",
  description: "Log each set of your active FORGE workout.",
};

export default function ActiveWorkoutPage() {
  return <ActiveWorkoutClient />;
}
