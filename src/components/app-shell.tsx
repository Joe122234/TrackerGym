"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  CircleUserRound,
  Dumbbell,
  Home,
  RefreshCcw,
  Ruler,
  Settings,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { useSessions } from "@/hooks/use-sessions";
import { useActiveWorkout } from "@/hooks/use-active-workout";
import { useOnlineStatus, OfflineBanner } from "@/hooks/use-online-status";
import { Wordmark } from "@/components/brand";
import { RestTimerDock } from "@/components/rest-timer-dock";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/workouts/", label: "Workouts", icon: Dumbbell },
  { href: "/progress/", label: "Progress", icon: TrendingUp },
  { href: "/body/", label: "Body", icon: Ruler },
  { href: "/settings/", label: "Settings", icon: Settings },
];

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  const current = normalizePathname(pathname);
  const target = normalizePathname(href);
  if (target === "/") return current === "/";
  if (exact) return current === target;
  return current === target || current.startsWith(`${target}/`);
}

function SyncStatus() {
  const online = useOnlineStatus();
  const { pendingWrites, loading: sessionsLoading } = useSessions();
  return (
    <div className="hidden items-center gap-2 text-[11px] text-muted-2 md:flex">
      <span
        className={cn(
          "size-1.5 rounded-full",
          !online
            ? "bg-warning"
            : pendingWrites
              ? "animate-[timer-pulse_1.4s_ease-in-out_infinite] bg-blue"
              : "bg-lime",
        )}
      />
      {!online
        ? "Offline"
        : pendingWrites
          ? "Syncing…"
          : sessionsLoading
            ? "Connecting…"
            : "All changes saved"}
    </div>
  );
}

function ActiveSessionBanner({ className }: { className?: string }) {
  const { activeSession } = useActiveWorkout();
  const pathname = usePathname();
  if (!activeSession || isActive(pathname, "/workout", true)) return null;
  return (
    <div
      className={cn(
        "mb-5 flex items-center gap-3 overflow-hidden rounded-2xl border border-lime/20 bg-lime/[0.06] px-4 py-3",
        className,
      )}
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime/10 text-lime">
        <Dumbbell className="size-4" />
        <span className="absolute -right-0.5 -top-0.5 size-2 animate-[timer-pulse_1.8s_ease-in-out_infinite] rounded-full bg-lime" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink">
          {activeSession.templateName} in progress
        </p>
        <p className="text-[11px] text-muted">
          Your sets are saved as you go.
        </p>
      </div>
      <Button asChild size="sm" variant="limeSoft" className="shrink-0">
        <Link href="/workout/">
          Resume <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUserData();
  const { user } = useAuth();
  const { activeSession } = useActiveWorkout();
  const displayName = profile?.displayName || user?.displayName || "Athlete";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-line bg-canvas-soft/80 px-4 py-5 backdrop-blur-xl md:flex">
      <Link href="/" className="px-2" aria-label="FORGE home">
        <Wordmark />
      </Link>

      <nav className="mt-8 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors",
                active
                  ? "bg-elevated text-ink"
                  : "text-muted hover:bg-elevated/60 hover:text-ink",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px]",
                  active ? "text-lime" : "text-muted-2 group-hover:text-muted",
                )}
              />
              {item.label}
              {active ? (
                <span className="ml-auto size-1 rounded-full bg-lime" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {activeSession ? (
        <Link
          href="/workout/"
          className="mt-6 block rounded-2xl border border-lime/20 bg-lime/[0.06] p-3 transition-colors hover:bg-lime/[0.09]"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-lime">
            <span className="size-1.5 animate-[timer-pulse_1.8s_ease-in-out_infinite] rounded-full bg-lime" />
            Active workout
          </p>
          <p className="mt-1.5 truncate text-[13px] font-semibold text-ink">
            {activeSession.templateName}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
            Resume logging <ArrowRight className="size-3" />
          </p>
        </Link>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-surface/70 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-2">
            {BRAND.name}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            Show up. Log honestly. Let the weeks stack.
          </p>
        </div>
      )}

      <div className="mt-auto">
        <Link
          href="/settings/"
          className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-3 transition-colors hover:bg-elevated"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-[11px] font-semibold text-lime">
            {initials(displayName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-ink">
              {displayName}
            </span>
            <span className="block text-[10px] text-muted-2">
              {profile?.timezone.replace("_", " ") ?? "Asia/Bangkok"}
            </span>
          </span>
          <CircleUserRound className="size-4 text-muted-2" />
        </Link>
        <p className="mt-3 px-2 text-[10px] text-muted-2">
          {BRAND.name} v{BRAND.version} · Private training log
        </p>
      </div>
    </aside>
  );
}

function MobileHeader() {
  const { profile } = useUserData();
  const { user } = useAuth();
  const displayName = profile?.displayName || user?.displayName || "Athlete";
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-canvas/80 px-4 py-3 backdrop-blur-xl md:hidden">
      <Link href="/" aria-label="FORGE home">
        <Wordmark />
      </Link>
      <Link
        href="/settings/"
        className="flex size-9 items-center justify-center rounded-full border border-line bg-elevated text-[10px] font-semibold text-lime"
        aria-label="Open settings"
      >
        {initials(displayName)}
      </Link>
    </header>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="nav-safe fixed inset-x-0 bottom-0 z-50 border-t border-line/80 bg-canvas/90 px-2 pt-1.5 backdrop-blur-xl md:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors",
                active ? "text-lime" : "text-muted-2 active:text-ink",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-10 items-center justify-center rounded-lg transition-colors",
                  active && "bg-lime/10",
                )}
              >
                <Icon className="size-[19px]" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SessionErrorBanner() {
  const { error, retry } = useSessions();
  if (!error) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-danger/25 bg-danger/[0.07] px-4 py-3 text-[12px] text-danger">
      <WifiOff className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{error}</span>
      <button
        type="button"
        onClick={retry}
        className="inline-flex items-center gap-1 font-semibold hover:underline"
      >
        <RefreshCcw className="size-3.5" /> Retry
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh">
      <a
        href="#page-content"
        className="fixed left-4 top-4 z-[100] -translate-y-20 rounded-lg bg-lime px-3 py-2 text-xs font-semibold text-canvas transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="md:pl-[252px]">
        <MobileHeader />
        <header className="hidden h-14 items-center justify-end border-b border-line/60 px-8 md:flex">
          <SyncStatus />
        </header>
        <main
          id="page-content"
          className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 sm:pt-7 md:px-8 md:pb-16"
        >
          <div className="mb-4">
            <OfflineBanner />
          </div>
          <SessionErrorBanner />
          <ActiveSessionBanner />
          <div key={pathname} className="animate-fade-up">
            {children}
          </div>
          <footer className="mt-14 border-t border-line/60 pt-5 text-[10px] leading-relaxed text-muted-2 md:flex md:items-center md:justify-between">
            <p>Your data stays in your Firebase project. No ad tech. No noise.</p>
            <p className="mt-1 md:mt-0">
              {BRAND.name} · Forged by consistency
            </p>
          </footer>
        </main>
      </div>
      <MobileNav />
      <RestTimerDock />
    </div>
  );
}
