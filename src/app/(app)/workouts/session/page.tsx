import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionDetailClient } from "./session-detail-client";
import { Splash } from "@/components/auth-boundary";

export const metadata: Metadata = {
  title: "Session detail",
  description: "Review a completed FORGE workout.",
};

export default function SessionDetailPage() {
  return (
    <Suspense fallback={<Splash label="Opening session" />}>
      <SessionDetailClient />
    </Suspense>
  );
}
