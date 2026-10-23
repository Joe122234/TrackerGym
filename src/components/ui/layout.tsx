import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="display text-[2rem] font-semibold leading-[1.02] text-ink sm:text-[2.5rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3.5 flex items-end justify-between gap-4",
        className,
      )}
    >
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  accent = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "default" | "lime" | "blue" | "violet";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-surface p-4 sm:p-5",
        className,
      )}
    >
      <div
        className={cn(
          "absolute -right-7 -top-8 size-24 rounded-full blur-2xl",
          accent === "lime" && "bg-lime/[0.06]",
          accent === "blue" && "bg-blue/[0.06]",
          accent === "violet" && "bg-violet/[0.06]",
          accent === "default" && "bg-white/[0.025]",
        )}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-muted-2">
          {label}
        </p>
        {icon ? (
          <span
            className={cn(
              "text-muted-2",
              accent === "lime" && "text-lime/70",
              accent === "blue" && "text-blue/70",
              accent === "violet" && "text-violet/70",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="tabular relative mt-1.5 text-[1.65rem] font-semibold leading-none tracking-[-0.04em] text-ink">
        {value}
      </div>
      {hint ? (
        <p className="relative mt-2 text-[11px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function MetricRing({
  value,
  size = 74,
  stroke = 6,
  label,
  sublabel,
  className,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  const safe = value === null ? 0 : Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        value === null
          ? label ?? "No data yet"
          : `${value}%${label ? ` ${label}` : ""}`
      }
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-elevated-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-lime)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-sm font-semibold text-ink">
          {value === null ? "—" : `${value}%`}
        </span>
        {sublabel ? (
          <span className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted-2">
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-panel border border-dashed border-line bg-surface/50 px-5 text-center",
        compact ? "py-8" : "py-12",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-line bg-elevated text-muted">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
