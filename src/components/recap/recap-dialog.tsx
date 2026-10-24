"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Minus,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BodyMeasurement,
  ExerciseDefinition,
  PersonalRecord,
  Profile,
  ScheduleEntry,
  WorkoutSession,
} from "@/domain/types";
import { formatDateKey, formatDurationLong } from "@/domain/dates";
import {
  buildRecap,
  buildSessionRecap,
  formatRecapPrMetric,
  formatRecapText,
  prDeltaText,
  type RecapData,
  type RecapLift,
  type RecapRange,
} from "@/domain/insights";
import {
  formatDeltaWeight,
  formatVolume,
  formatWeight,
} from "@/domain/units";
import { downloadRecapCard } from "@/lib/share-card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkline } from "@/components/ui/sparkline";

const RANGES: RecapRange[] = ["week", "month", "30d", "all"];
const RANGE_SHORT_LABELS: Record<RecapRange, string> = {
  week: "Week",
  month: "Month",
  "30d": "30 days",
  all: "All",
};

export interface RecapSource {
  sessions: WorkoutSession[];
  records: PersonalRecord[];
  measurements: BodyMeasurement[];
  definitions: ExerciseDefinition[];
  schedule: ScheduleEntry[];
  profile: Profile | null;
  today: string;
}

interface RecapButtonProps extends Omit<ButtonProps, "children">, RecapSource {
  label?: string;
  initialRange?: RecapRange;
  session?: WorkoutSession | null;
  previousSession?: WorkoutSession | null;
  dialogTitle?: string;
  iconOnly?: boolean;
}

export function RecapButton({
  label = "Recap",
  initialRange = "week",
  session = null,
  previousSession = null,
  dialogTitle,
  iconOnly = false,
  sessions,
  records,
  measurements,
  definitions,
  schedule,
  profile,
  today,
  className,
  variant = "secondary",
  size = "default",
  ...buttonProps
}: RecapButtonProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-2", className)}
        aria-label={iconOnly ? label : buttonProps["aria-label"]}
        onClick={() => setOpen(true)}
        {...buttonProps}
      >
        <Sparkles className="size-4" aria-hidden />
        {iconOnly ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span>{label}</span>
        )}
      </Button>
      <RecapDialog
        open={open}
        onOpenChange={setOpen}
        initialRange={initialRange}
        session={session}
        previousSession={previousSession}
        dialogTitle={dialogTitle}
        sessions={sessions}
        records={records}
        measurements={measurements}
        definitions={definitions}
        schedule={schedule}
        profile={profile}
        today={today}
      />
    </>
  );
}

interface RecapDialogProps extends RecapSource {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRange?: RecapRange;
  session?: WorkoutSession | null;
  previousSession?: WorkoutSession | null;
  dialogTitle?: string;
}

export function RecapDialog({
  open,
  onOpenChange,
  initialRange = "week",
  session = null,
  previousSession = null,
  dialogTitle,
  sessions,
  records,
  measurements,
  definitions,
  schedule,
  profile,
  today,
}: RecapDialogProps) {
  const [range, setRange] = React.useState<RecapRange>(initialRange);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setRange(initialRange);
      setCopied(false);
    }
  }, [open, initialRange]);

  const data = React.useMemo<RecapData>(() => {
    if (session) {
      return buildSessionRecap({
        session,
        previousSession,
        definitions,
        profile,
        measurements,
      });
    }
    return buildRecap({
      sessions,
      records,
      measurements,
      definitions,
      schedule,
      profile,
      today,
      range,
    });
  }, [
    session,
    previousSession,
    definitions,
    profile,
    measurements,
    sessions,
    records,
    schedule,
    today,
    range,
  ]);

  const copy = async () => {
    const text = formatRecapText(data);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Recap copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      textarea.remove();
      if (success) {
        setCopied(true);
        toast.success("Recap copied");
        window.setTimeout(() => setCopied(false), 1800);
      } else {
        toast.error("Could not copy the recap");
      }
    }
  };

  const download = () => {
    try {
      downloadRecapCard(data);
      toast.success("Recap card saved");
    } catch {
      toast.error("Could not render the recap card");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="pb-0 sm:max-w-[44rem] sm:pb-0">
        <DialogHeader className="mb-4 pr-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
            {session ? "Session recap" : "Training recap"}
          </p>
          <DialogTitle>
            {dialogTitle ??
              (session ? "A clean look at today." : "The work, in one look.")}
          </DialogTitle>
          <DialogDescription>
            {session
              ? "Built from the sets you just logged. Save it, share it, or keep moving."
              : "A deterministic read of your log. No estimates, no guessing — just the work you recorded."}
          </DialogDescription>
        </DialogHeader>

        {!session ? (
          <div
            className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Recap range"
          >
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                aria-pressed={range === option}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors",
                  range === option
                    ? "border-lime/40 bg-lime/10 text-lime"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {RANGE_SHORT_LABELS[option]}
              </button>
            ))}
          </div>
        ) : null}

        <RecapCardPreview data={data} />

        {data.topLifts.length > 0 ? (
          <section className="mt-6" aria-labelledby="recap-top-lifts">
            <div className="mb-2.5 flex items-end justify-between gap-3">
              <div>
                <h3
                  id="recap-top-lifts"
                  className="text-sm font-semibold tracking-[-0.01em] text-ink"
                >
                  Top 8-rep work
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  Best completed set in this window
                </p>
              </div>
              <TrendingUp className="size-4 text-lime/70" aria-hidden />
            </div>
            <div className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface">
              {data.topLifts.map((lift) => (
                <LiftRow
                  key={lift.exerciseId}
                  lift={lift}
                  weightUnit={data.weightUnit}
                />
              ))}
            </div>
          </section>
        ) : null}

        {data.prGroups.length > 0 ? (
          <section className="mt-6" aria-labelledby="recap-prs">
            <div className="mb-2.5 flex items-end justify-between gap-3">
              <div>
                <h3
                  id="recap-prs"
                  className="text-sm font-semibold tracking-[-0.01em] text-ink"
                >
                  New marks
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  Grouped by lift, estimated maxes hidden
                </p>
              </div>
              <Badge variant="lime">{data.prGroups.length} lifts</Badge>
            </div>
            <div className="grid gap-2">
              {data.prGroups.slice(0, 6).map((group) => (
                <div
                  key={`${group.exerciseId ?? "session"}-${group.exerciseName}`}
                  className="rounded-2xl border border-line bg-surface p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-ink">
                      {group.exerciseName}
                    </p>
                    <Badge variant="lime" className="shrink-0">
                      PR
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {group.metrics.slice(0, 3).map((pr) => {
                      const delta = prDeltaText(pr, data.weightUnit);
                      return (
                        <span
                          key={`${pr.metric}-${pr.scopeKey}`}
                          className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-1 text-[11px] text-muted"
                        >
                          {pr.label} · {formatRecapPrMetric(pr, data.weightUnit)}
                          {delta ? (
                            <span className="text-lime">· {delta}</span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {data.attentionLifts.length > 0 ? (
          <section className="mt-6" aria-labelledby="recap-attention">
            <h3
              id="recap-attention"
              className="text-sm font-semibold tracking-[-0.01em] text-ink"
            >
              Worth a look
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Flat or missing against the previous window
            </p>
            <div className="mt-2.5 grid gap-2">
              {data.attentionLifts.map((lift) => (
                <div
                  key={lift.exerciseId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {lift.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Previous best {formatWeight(lift.previousBestKg, data.weightUnit)}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="tabular block text-sm font-semibold text-ink">
                      {lift.bestWeightKg === null
                        ? "Not hit"
                        : formatWeight(lift.bestWeightKg, data.weightUnit)}
                    </span>
                    {lift.deltaKg !== null ? (
                      <span
                        className={cn(
                          "tabular text-[11px] font-medium",
                          lift.deltaKg > 0
                            ? "text-lime"
                            : lift.deltaKg < 0
                              ? "text-danger"
                              : "text-muted",
                        )}
                      >
                        {formatDeltaWeight(lift.deltaKg, data.weightUnit)}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6" aria-labelledby="recap-balance">
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <div>
              <h3
                id="recap-balance"
                className="text-sm font-semibold tracking-[-0.01em] text-ink"
              >
                Balance
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                {data.scope === "session"
                  ? "Completed sets in this session"
                  : "Average completed sets per week"}
              </p>
            </div>
            <Target className="size-4 text-muted-2" aria-hidden />
          </div>
          <div className="grid gap-2.5 rounded-2xl border border-line bg-surface p-4">
            {data.muscleBalance.map((row) => {
              const max = Math.max(
                row.targetMax,
                row.weeklyAverage,
                data.scope === "session" ? row.sets : 1,
              );
              const width = Math.min(
                100,
                (data.scope === "session"
                  ? row.sets / Math.max(1, max)
                  : row.weeklyAverage / Math.max(1, max)) * 100,
              );
              const targetStart =
                data.scope === "session"
                  ? null
                  : (row.targetMin / Math.max(1, max)) * 100;
              const targetEnd =
                data.scope === "session"
                  ? null
                  : (row.targetMax / Math.max(1, max)) * 100;
              return (
                <div key={row.category}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-medium text-ink">{row.label}</span>
                    <span className="tabular text-muted">
                      {data.scope === "session"
                        ? `${row.sets} sets`
                        : `${row.weeklyAverage} / wk`}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-elevated">
                    {targetStart !== null && targetEnd !== null ? (
                      <span
                        className="absolute inset-y-0 rounded-full bg-white/[0.055]"
                        style={{
                          left: `${targetStart}%`,
                          width: `${Math.max(0, targetEnd - targetStart)}%`,
                        }}
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={cn(
                        "relative block h-full rounded-full",
                        row.weeklyAverage < row.targetMin &&
                          data.scope !== "session"
                          ? "bg-warning/70"
                          : "bg-lime/80",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  {data.scope !== "session" ? (
                    <p className="mt-1 text-[10px] text-muted-2">
                      Target {row.targetMin}–{row.targetMax} sets / week
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {data.bodyWeightChangeKg !== null ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted">
              <Scale className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink">Bodyweight</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {formatWeight(data.bodyWeightStartKg, data.weightUnit)} →{" "}
                {formatWeight(data.bodyWeightEndKg, data.weightUnit)}
              </p>
            </div>
            <p
              className={cn(
                "tabular shrink-0 text-sm font-semibold",
                data.bodyWeightChangeKg > 0 ? "text-lime" : "text-muted",
              )}
            >
              {formatDeltaWeight(data.bodyWeightChangeKg, data.weightUnit)}
            </p>
          </div>
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6 sm:pb-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1"
              onClick={copy}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              type="button"
              variant="primary"
              className="min-h-11 flex-1"
              onClick={download}
            >
              <Download className="size-4" />
              Save card
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-2">
            {data.scope === "session"
              ? `${formatDurationLong(data.durationSeconds)} · ${data.sets} sets · ${data.reps} reps`
              : `${data.periodSubLabel} · ${data.sets} sets · ${data.reps} reps`}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LiftRow({
  lift,
  weightUnit,
}: {
  lift: RecapLift;
  weightUnit: RecapData["weightUnit"];
}) {
  const positive = lift.deltaKg !== null && lift.deltaKg > 0;
  const negative = lift.deltaKg !== null && lift.deltaKg < 0;
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{lift.name}</p>
        <p className="mt-0.5 text-[11px] text-muted">
          {lift.sessionCount} session{lift.sessionCount === 1 ? "" : "s"} ·{" "}
          {formatDateKey(lift.lastDate, "MMM d")}
        </p>
      </div>
      {lift.trend.length >= 2 ? (
        <Sparkline
          values={lift.trend.map((point) => point.weightKg)}
          className="hidden h-7 w-16 shrink-0 opacity-70 sm:block"
          width={64}
          height={28}
        />
      ) : null}
      <div className="shrink-0 text-right">
        <p className="tabular text-sm font-semibold text-ink">
          {formatWeight(lift.bestWeightKg, weightUnit)} × {lift.bestReps ?? "—"}
        </p>
        <p
          className={cn(
            "tabular mt-0.5 flex items-center justify-end gap-0.5 text-[11px]",
            positive ? "text-lime" : negative ? "text-danger" : "text-muted-2",
          )}
        >
          {positive ? (
            <ArrowUpRight className="size-3" aria-hidden />
          ) : negative ? (
            <ArrowDownRight className="size-3" aria-hidden />
          ) : (
            <Minus className="size-3" aria-hidden />
          )}
          {lift.deltaKg === null
            ? "new window"
            : lift.deltaKg === 0
              ? "flat"
              : formatDeltaWeight(lift.deltaKg, weightUnit)}
        </p>
      </div>
    </div>
  );
}

function RecapCardPreview({ data }: { data: RecapData }) {
  return (
    <section
      className="relative overflow-hidden rounded-[1.4rem] border border-lime/20 bg-[#0a0e0c] p-4 sm:p-5"
      aria-label="Recap preview"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-lime/[0.09] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,var(--color-lime)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-lime)_1px,transparent_1px)] [background-size:28px_28px]"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] bg-lime" aria-hidden />
            <span className="text-sm font-bold tracking-[-0.03em] text-ink">
              FORGE
            </span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-2">
            Training recap
          </span>
        </div>

        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-lime">
          {data.periodLabel}
        </p>
        <p className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-ink">
          {data.periodSubLabel}
        </p>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
          {data.headline}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            {
              label: data.scope === "session" ? "Sets" : "Sessions",
              value: data.scope === "session" ? data.sets : data.sessions,
            },
            {
              label: "Volume",
              value: formatVolume(data.volumeKg, data.weightUnit),
            },
            { label: "PR lifts", value: data.prGroups.length },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-2.5"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-2">
                {stat.label}
              </p>
              <p className="tabular mt-1 text-[12px] font-semibold leading-tight text-ink sm:text-sm">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {data.topLifts.length > 0 ? (
          <div className="mt-4 space-y-1.5">
            {data.topLifts.slice(0, 3).map((lift) => (
              <div
                key={lift.exerciseId}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-2.5 py-2"
              >
                <span className="min-w-0 truncate text-[11px] text-muted">
                  {lift.name}
                </span>
                <span className="tabular shrink-0 text-[11px] font-semibold text-lime">
                  {formatWeight(lift.bestWeightKg, data.weightUnit)} ×{" "}
                  {lift.bestReps ?? "—"}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-lime/15 bg-lime/[0.055] p-2.5">
          <Target className="mt-0.5 size-3.5 shrink-0 text-lime" aria-hidden />
          <p className="text-[11px] leading-relaxed text-ink/85">{data.focus}</p>
        </div>
      </div>
    </section>
  );
}
