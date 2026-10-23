"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  CloudDownload,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  LayoutGrid,
  RotateCcw,
  Smartphone,
  Timer,
  UserRound,
  Weight,
} from "lucide-react";
import { toast } from "sonner";
import type { MeasurementUnit, WeightUnit } from "@/domain/types";
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  kgToDisplay,
  parseNumericInput,
  round,
} from "@/domain/units";
import { dateKeyInTimeZone, formatDateKey } from "@/domain/dates";
import {
  buildUserExport,
  downloadTextFile,
  measurementsToCsv,
  workoutsToCsv,
} from "@/lib/firebase/export";
import { restoreStartingSplit } from "@/lib/firebase/seed";
import { updatePreferences, updateProfile } from "@/lib/firebase/profile";
import { useAuth } from "@/hooks/use-auth";
import { useActiveWorkout } from "@/hooks/use-active-workout";
import { useUserData } from "@/hooks/use-user-data";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TIMEZONES = [
  "Asia/Bangkok",
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Jakarta",
  "Asia/Ho_Chi_Minh",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Africa/Johannesburg",
  "UTC",
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function SettingsCard({
  icon,
  title,
  description,
  children,
  tone = "default",
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "p-5 sm:p-6",
        tone === "danger" && "border-danger/20",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            tone === "danger"
              ? "border-danger/25 bg-danger/10 text-danger"
              : "border-line bg-elevated text-muted",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function useInstallPrompt() {
  const [promptEvent, setPromptEvent] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);

  React.useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setPromptEvent(null);
      return true;
    }
    return false;
  };

  return { installed, isIos, canPrompt: Boolean(promptEvent), install };
}

export function SettingsClient() {
  const { user } = useAuth();
  const { profile, preferences, loading: dataLoading } = useUserData();
  const { activeSession } = useActiveWorkout();
  const install = useInstallPrompt();
  const [now] = React.useState(() => Date.now());
  const timezone = profile?.timezone ?? "Asia/Bangkok";
  const today = dateKeyInTimeZone(now, timezone);

  const [displayName, setDisplayName] = React.useState(
    profile?.displayName ?? "",
  );
  const [heightInput, setHeightInput] = React.useState(
    profile ? String(round(cmToDisplay(profile.heightCm, profile.measurementUnit), 1)) : "",
  );
  const [weightInput, setWeightInput] = React.useState(
    profile ? String(round(kgToDisplay(profile.weightKg, profile.weightUnit), 1)) : "",
  );
  const [weightUnit, setWeightUnit] = React.useState<WeightUnit>(
    profile?.weightUnit ?? "kg",
  );
  const [measurementUnit, setMeasurementUnit] = React.useState<MeasurementUnit>(
    profile?.measurementUnit ?? "cm",
  );
  const [profileTimezone, setProfileTimezone] = React.useState(timezone);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [savingProfile, setSavingProfile] = React.useState(false);

  const [defaultSets, setDefaultSets] = React.useState(
    String(preferences?.defaultSets ?? 3),
  );
  const [defaultReps, setDefaultReps] = React.useState(
    String(preferences?.defaultReps ?? 8),
  );
  const [defaultRest, setDefaultRest] = React.useState(
    String(preferences?.defaultRestSeconds ?? 90),
  );
  const [timerSound, setTimerSound] = React.useState(
    preferences?.timerSound ?? true,
  );
  const [timerVibration, setTimerVibration] = React.useState(
    preferences?.timerVibration ?? true,
  );
  const [preferencesError, setPreferencesError] = React.useState<string | null>(
    null,
  );
  const [savingPreferences, setSavingPreferences] = React.useState(false);

  const [exporting, setExporting] = React.useState<
    "json" | "workouts" | "measurements" | null
  >(null);
  const [restoring, setRestoring] = React.useState(false);
  const [restoreOpen, setRestoreOpen] = React.useState(false);

  const timezoneOptions = React.useMemo(() => {
    const values = new Set(TIMEZONES);
    if (profile?.timezone) values.add(profile.timezone);
    if (profileTimezone) values.add(profileTimezone);
    return [...values].sort((a, b) =>
      a === "Asia/Bangkok" ? -1 : b === "Asia/Bangkok" ? 1 : a.localeCompare(b),
    );
  }, [profile?.timezone, profileTimezone]);

  const handleWeightUnitChange = (next: WeightUnit) => {
    if (next === weightUnit) return;
    const parsed = parseNumericInput(weightInput);
    if (parsed !== null) {
      const kg = displayToKg(parsed, weightUnit);
      setWeightInput(String(round(kgToDisplay(kg, next), 1)));
    }
    setWeightUnit(next);
  };

  const handleMeasurementUnitChange = (next: MeasurementUnit) => {
    if (next === measurementUnit) return;
    const parsed = parseNumericInput(heightInput);
    if (parsed !== null) {
      const cm = displayToCm(parsed, measurementUnit);
      setHeightInput(String(round(cmToDisplay(cm, next), 1)));
    }
    setMeasurementUnit(next);
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setProfileError(null);
    if (!displayName.trim()) {
      setProfileError("Enter a display name.");
      return;
    }
    const height = parseNumericInput(heightInput);
    const weight = parseNumericInput(weightInput);
    if (height === null) {
      setProfileError(`Enter a valid height in ${measurementUnit}.`);
      return;
    }
    if (weight === null) {
      setProfileError(`Enter a valid body weight in ${weightUnit}.`);
      return;
    }
    const heightCm = round(displayToCm(height, measurementUnit), 2);
    const weightKg = round(displayToKg(weight, weightUnit), 3);
    if (heightCm < 50 || heightCm > 300) {
      setProfileError("Height must be between 50 and 300 cm.");
      return;
    }
    if (weightKg < 20 || weightKg > 500) {
      setProfileError("Body weight must be between 20 and 500 kg.");
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile(user.uid, {
        displayName: displayName.trim(),
        heightCm,
        weightKg,
        weightUnit,
        measurementUnit,
        timezone: profileTimezone,
      });
      toast.success("Profile saved.");
    } catch (cause) {
      setProfileError(
        cause instanceof Error ? cause.message : "Could not save your profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user || !preferences) return;
    setPreferencesError(null);
    const sets = parseNumericInput(defaultSets);
    const reps = parseNumericInput(defaultReps);
    const rest = parseNumericInput(defaultRest);
    if (sets === null || !Number.isInteger(sets) || sets < 1 || sets > 12) {
      setPreferencesError("Default sets must be a whole number from 1 to 12.");
      return;
    }
    if (reps === null || !Number.isInteger(reps) || reps < 1 || reps > 100) {
      setPreferencesError("Default reps must be a whole number from 1 to 100.");
      return;
    }
    if (rest === null || !Number.isInteger(rest) || rest < 0 || rest > 900) {
      setPreferencesError("Default rest must be a whole number from 0 to 900 seconds.");
      return;
    }
    setSavingPreferences(true);
    try {
      await updatePreferences(user.uid, preferences, {
        onboardingComplete: true,
        defaultSets: sets,
        defaultReps: reps,
        defaultRestSeconds: rest,
        timerSound,
        timerVibration,
      });
      toast.success("Training defaults saved.");
    } catch (cause) {
      setPreferencesError(
        cause instanceof Error
          ? cause.message
          : "Could not save your preferences.",
      );
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleExport = async (kind: "json" | "workouts" | "measurements") => {
    if (!user) return;
    setExporting(kind);
    try {
      const data = await buildUserExport(user.uid);
      const stamp = today.replaceAll("-", "");
      if (kind === "json") {
        downloadTextFile(
          `forge-export-${stamp}.json`,
          JSON.stringify(data, null, 2),
          "application/json",
        );
      } else if (kind === "workouts") {
        downloadTextFile(
          `forge-workouts-${stamp}.csv`,
          workoutsToCsv(data),
          "text/csv",
        );
      } else {
        downloadTextFile(
          `forge-measurements-${stamp}.csv`,
          measurementsToCsv(data),
          "text/csv",
        );
      }
      toast.success("Export downloaded.");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not build the export.",
      );
    } finally {
      setExporting(null);
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    setRestoring(true);
    try {
      await restoreStartingSplit(user.uid);
      toast.success("Starting split restored. Completed history is untouched.");
      setRestoreOpen(false);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not restore the starting split.",
      );
    } finally {
      setRestoring(false);
    }
  };

  const memberSince = profile
    ? formatDateKey(
        dateKeyInTimeZone(profile.createdAt, profile.timezone),
        "MMMM d, yyyy",
      )
    : "—";

  if (dataLoading || !profile || !preferences) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skeleton h-96 rounded-panel" />
          <div className="skeleton h-96 rounded-panel" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Your system"
        description="Profile, training defaults, install state, and exports. This log is yours alone and opens without a sign-in screen."
      />

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <SettingsCard
            icon={<UserRound className="size-4" />}
            title="This device"
            description="A single-user log with no email, password, or onboarding."
          >
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-canvas-soft/45 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-lime/20 bg-lime/10 text-[12px] font-semibold text-lime">
                {initials(profile.displayName || "Henry")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {profile.displayName}
                </p>
                <p className="truncate text-[10px] text-muted-2">
                  Private training log
                </p>
              </div>
              <Badge variant="outline">No login</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-line bg-canvas-soft/30 px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-2">
                  Height
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-ink">
                  {String(round(cmToDisplay(profile.heightCm, profile.measurementUnit), 1))}{" "}
                  {profile.measurementUnit}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-canvas-soft/30 px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-2">
                  Weight
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-ink">
                  {String(round(kgToDisplay(profile.weightKg, profile.weightUnit), 1))}{" "}
                  {profile.weightUnit}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-canvas-soft/30 px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-2">
                  Since
                </p>
                <p className="mt-0.5 truncate text-[12px] font-semibold text-ink">
                  {memberSince}
                </p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted-2">
              <KeyRound className="mt-0.5 size-3 shrink-0" />
              FORGE silently keeps a private Firebase session on this browser.
              No email or password is ever requested. This log is tied to this
              browser, so export a copy before clearing site data.
            </p>
          </SettingsCard>

          <SettingsCard
            icon={<LayoutGrid className="size-4" />}
            title="Install FORGE"
            description="A standalone app with offline shell caching and one-tap access."
          >
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-canvas-soft/40 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-elevated text-lime">
                <Smartphone className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                {install.installed ? (
                  <>
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                      <Check className="size-3.5 text-lime" /> Installed
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">
                      FORGE is running from your home screen. The app shell is
                      cached for offline launches; Firebase still needs a
                      connection to save new changes.
                    </p>
                  </>
                ) : install.canPrompt ? (
                  <>
                    <p className="text-[12px] font-semibold text-ink">
                      Add FORGE to your device
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">
                      Launch from your home screen or dock without browser
                      chrome.
                    </p>
                    <Button
                      className="mt-3"
                      size="sm"
                      onClick={() => {
                        void install.install().then((accepted) => {
                          if (accepted) toast.success("FORGE installed.");
                        });
                      }}
                    >
                      <Download /> Install app
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-[12px] font-semibold text-ink">
                      Install from your browser
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">
                      {install.isIos
                        ? "In Safari, tap Share, then Add to Home Screen. iOS installs work only from Safari."
                        : "Open the browser menu and choose Install app or Add to Home Screen. Installation requires HTTPS."}
                    </p>
                    <p className="mt-2 text-[9px] leading-relaxed text-muted-2">
                      If your browser does not offer installation, the app still
                      works normally in a tab.
                    </p>
                  </>
                )}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<Download className="size-4" />}
            title="Data export"
            description="Your data is yours. Exports are generated on demand from Firestore."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => void handleExport("json")}
                loading={exporting === "json"}
                disabled={Boolean(exporting)}
                className="justify-start"
              >
                <FileJson /> Full JSON archive
              </Button>
              <Button
                variant="secondary"
                onClick={() => void handleExport("workouts")}
                loading={exporting === "workouts"}
                disabled={Boolean(exporting)}
                className="justify-start"
              >
                <FileSpreadsheet /> Workouts CSV
              </Button>
              <Button
                variant="secondary"
                onClick={() => void handleExport("measurements")}
                loading={exporting === "measurements"}
                disabled={Boolean(exporting)}
                className="justify-start sm:col-span-2"
              >
                <FileSpreadsheet /> Measurements CSV
              </Button>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted-2">
              <CloudDownload className="mt-0.5 size-3 shrink-0" />
              The JSON archive includes profile, preferences, templates, the
              weekly split, every session including an active draft, body
              measurements, and derived PR/achievement records. Keep a copy
              outside Firebase. This build keeps the live log on this browser
              session rather than a cross-device login.
            </p>
          </SettingsCard>
        </div>

        <div className="space-y-4">
          <SettingsCard
            icon={<UserRound className="size-4" />}
            title="Profile & display"
            description="Canonical values stay in kilograms and centimeters."
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="settings-name">Display name</Label>
                <Input
                  id="settings-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={80}
                  autoComplete="name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-height">
                    Height ({measurementUnit})
                  </Label>
                  <Input
                    id="settings-height"
                    inputMode="decimal"
                    value={heightInput}
                    onChange={(event) => setHeightInput(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-weight">
                    Body weight ({weightUnit})
                  </Label>
                  <Input
                    id="settings-weight"
                    inputMode="decimal"
                    value={weightInput}
                    onChange={(event) => setWeightInput(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Weight unit</Label>
                  <Select
                    value={weightUnit}
                    onValueChange={(value) =>
                      handleWeightUnitChange(value as WeightUnit)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="lb">Pounds (lb)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Measurements</Label>
                  <Select
                    value={measurementUnit}
                    onValueChange={(value) =>
                      handleMeasurementUnitChange(value as MeasurementUnit)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm">Centimeters (cm)</SelectItem>
                      <SelectItem value="in">Inches (in)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Training timezone</Label>
                <Select
                  value={profileTimezone}
                  onValueChange={setProfileTimezone}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[9px] leading-relaxed text-muted-2">
                  Used for session dates, streaks, and the calendar. Default:{" "}
                  Asia/Bangkok.
                </p>
              </div>
              <FieldError>{profileError}</FieldError>
              <Button
                onClick={() => void handleSaveProfile()}
                loading={savingProfile}
              >
                <Check /> Save profile
              </Button>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<Timer className="size-4" />}
            title="Training defaults"
            description="Applied when you create new templates or exercises. Existing targets are never rewritten."
          >
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-sets">Sets</Label>
                  <Input
                    id="settings-sets"
                    inputMode="numeric"
                    value={defaultSets}
                    onChange={(event) => setDefaultSets(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-reps">Reps</Label>
                  <Input
                    id="settings-reps"
                    inputMode="numeric"
                    value={defaultReps}
                    onChange={(event) => setDefaultReps(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-rest">Rest (s)</Label>
                  <Input
                    id="settings-rest"
                    inputMode="numeric"
                    value={defaultRest}
                    onChange={(event) => setDefaultRest(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas-soft/35 px-3.5 py-3">
                <div>
                  <p className="text-[11px] font-medium text-ink">
                    Rest timer sound
                  </p>
                  <p className="text-[9px] text-muted-2">
                    Beep when the countdown completes
                  </p>
                </div>
                <Switch
                  checked={timerSound}
                  onCheckedChange={setTimerSound}
                  aria-label="Rest timer sound"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas-soft/35 px-3.5 py-3">
                <div>
                  <p className="text-[11px] font-medium text-ink">
                    Vibration
                  </p>
                  <p className="text-[9px] text-muted-2">
                    Where the device supports vibration
                  </p>
                </div>
                <Switch
                  checked={timerVibration}
                  onCheckedChange={setTimerVibration}
                  aria-label="Rest timer vibration"
                />
              </div>
              <FieldError>{preferencesError}</FieldError>
              <Button
                onClick={() => void handleSavePreferences()}
                loading={savingPreferences}
              >
                <Check /> Save defaults
              </Button>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<Database className="size-4" />}
            title="Training plan"
            description="Restore the exact starting split without touching completed history."
          >
            <div className="rounded-xl border border-warning/20 bg-warning/[0.04] p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-warning">
                <AlertTriangle className="size-3.5" /> Destructive template reset
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                This deletes every current template and schedule entry, including
                custom templates, then recreates the seeded Monday–Sunday split.
                Completed sessions, measurements, PRs, and achievements stay
                untouched.
              </p>
            </div>
            {activeSession ? (
              <p className="mt-3 text-[10px] leading-relaxed text-danger">
                Finish or discard your active workout before restoring the
                split.
              </p>
            ) : null}
            <Button
              variant="secondary"
              className="mt-3"
              disabled={Boolean(activeSession)}
              onClick={() => setRestoreOpen(true)}
            >
              <RotateCcw /> Restore starting split
            </Button>
          </SettingsCard>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-line/60 pt-4 text-[10px] text-muted-2">
        <KeyRound className="size-3" />
        Data is stored privately for this browser in Firebase. Export a JSON
        copy before clearing site data.
        <span className="ml-auto flex items-center gap-1">
          <Weight className="size-3" /> Canonical kg/cm
        </span>
      </div>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore the starting split?</AlertDialogTitle>
            <AlertDialogDescription>
              Every current template and schedule entry will be deleted and the
              original Push/Pull/Legs/Cardio/Upper/Legs/Rest plan recreated.
              Custom templates will be lost. Completed workout history remains
              exactly as recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-warning text-canvas hover:bg-warning/90"
              disabled={restoring}
              onClick={(event) => {
                event.preventDefault();
                void handleRestore();
              }}
            >
              {restoring ? "Restoring…" : "Restore starting split"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
