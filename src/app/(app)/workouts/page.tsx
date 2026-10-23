import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkoutsClient } from "./workouts-client";
import { Splash } from "@/components/auth-boundary";

export const metadata: Metadata = {
  title: "Workouts",
  description: "Your weekly split, workout templates, and complete training history.",
};

export default function WorkoutsPage() {
  return (
    <Suspense fallback={<Splash label="Opening your workouts" />}>
      <WorkoutsClient />
    </Suspense>
  );
}
