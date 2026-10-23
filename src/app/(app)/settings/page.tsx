import type { Metadata } from "next";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Manage your FORGE profile, training defaults, app installation, exports, and account.",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
