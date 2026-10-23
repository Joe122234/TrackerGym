"use client";

import * as React from "react";
import { ArrowRight, RefreshCcw, ServerCog } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { BrandMark, Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";

export function Splash({ label = "Loading your training" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="relative">
        <div className="absolute -inset-5 rounded-full bg-lime/10 blur-2xl" />
        <BrandMark size="lg" className="relative" />
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink">
          {BRAND.name}
        </p>
        <p className="mt-2 text-sm text-muted">{label}…</p>
      </div>
      <div className="h-1 w-28 overflow-hidden rounded-full bg-elevated-2">
        <div className="h-full w-1/2 animate-[timer-pulse_1.4s_ease-in-out_infinite] rounded-full bg-lime" />
      </div>
    </div>
  );
}

export function ConfigRequired() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg">
        <Wordmark showTagline />
        <div className="mt-8 rounded-panel border border-line bg-surface p-6 sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-lime/20 bg-lime/10 text-lime">
            <ServerCog className="size-5" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">
            Firebase setup required
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This build is missing the public Firebase project settings. The
            normal FORGE build includes them, so a clean checkout should never
            show this screen.
          </p>
          <div className="mt-5 rounded-xl border border-line bg-canvas-soft p-4 font-mono text-[12px] leading-relaxed text-muted">
            <p className="text-ink">NEXT_PUBLIC_FIREBASE_API_KEY=…</p>
            <p>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=…</p>
            <p>NEXT_PUBLIC_FIREBASE_PROJECT_ID=…</p>
            <p>NEXT_PUBLIC_FIREBASE_APP_ID=…</p>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-2">
            See <span className="text-muted">src/lib/firebase/public-config.ts</span>{" "}
            and the README. No login or paid Firebase plan is required.
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-panel border border-line bg-surface p-6 text-center">
        <BrandMark className="mx-auto" />
        <h1 className="mt-5 text-xl font-semibold tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
        {onRetry ? (
          <Button className="mt-5" onClick={onRetry}>
            <RefreshCcw /> Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Data boundary, not an authentication gate. Every device uses the same public
 * Firestore namespace, so there is no session to wait for or recover.
 */
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading: authLoading,
    configured,
    error: authError,
    retry: retryAuth,
  } = useAuth();
  const {
    profile,
    preferences,
    loading: dataLoading,
    error: dataError,
    retry: retryData,
  } = useUserData();

  if (!configured) return <ConfigRequired />;
  if (authLoading) return <Splash label="Opening your shared log" />;
  if (authError) {
    return (
      <ErrorScreen
        title="This device could not start the log"
        message={authError}
        onRetry={retryAuth}
      />
    );
  }
  if (!user) return <Splash label="Starting your log" />;
  if (dataLoading) return <Splash />;
  if (dataError) {
    return (
      <ErrorScreen
        title="Your data could not be loaded"
        message={dataError}
        onRetry={retryData}
      />
    );
  }
  if (!profile || !preferences) {
    return (
      <ErrorScreen
        title="Setup is incomplete"
        message="The shared log exists, but its profile or preferences are missing. Retry setup, or check your Firestore data."
        onRetry={retryData}
      />
    );
  }

  return <>{children}</>;
}

export function SetupLink() {
  return (
    <a
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime hover:underline"
      href="/settings/"
    >
      Open settings <ArrowRight className="size-3.5" />
    </a>
  );
}
