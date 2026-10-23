import type { Metadata } from "next";
import { Suspense } from "react";
import { TemplateEditorClient } from "./template-editor-client";
import { Splash } from "@/components/auth-boundary";

export const metadata: Metadata = {
  title: "Edit workout",
  description: "Build and edit a FORGE workout template.",
};

export default function TemplateEditorPage() {
  return (
    <Suspense fallback={<Splash label="Opening the workout editor" />}>
      <TemplateEditorClient />
    </Suspense>
  );
}
