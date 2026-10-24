"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Dumbbell,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type {
  BodyMeasurement,
  ExerciseDefinition,
  PersonalRecord,
  Profile,
  ScheduleEntry,
  WorkoutSession,
} from "@/domain/types";
import {
  buildSessionRecap,
  formatRecapPrMetric,
  type RecapData,
} from "@/domain/insights";
import { formatDateKey, formatDurationLong } from "@/domain/dates";
import {
  formatDeltaWeight,
  formatVolume,
  formatWeight,
} from "@/domain/units";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RecapButton } from "@/components/recap/recap-dialog";

export function SessionSummary({
  session,
  previousSession,
  sessions,
  records,
  measurements,
  definitions,
  schedule,
  profile,
  today,
}: {
  session: WorkoutSession;
  previousSession: WorkoutSession | null;
  sessions: WorkoutSession[];
  records: PersonalRecord[];
  measurements: BodyMeasurement[];
  definitions: ExerciseDefinition[];
  schedule: ScheduleEntry[];
  profile: Profile | null;
  today: string;
}) {
  const recap = React.useMemo<RecapData>(
    () =>
      buildSessionRecap({
        session,
        previousSession,
        definitions,
        profile,
        measurements,
      }),
    [session, previousSession, definitions, profile, measurements],
  );

  const volumeComparison =
    recap.comparison.volumePct !== null && recap.comparison.previousVolumeKg !== null
      ? recap.comparison.volumePct
      : null;

  return (
    <Card tone="accent" className="mt-5 overflow-hidden">
      <div className="relative border-b border-lime/15 bg-[#0a0e0c] p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -right-14 -top-16 size-56 rounded-full bg-lime/[0.10] blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full border border-lime/30 bg-lime/15 text-lime">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-lime">
              Workout complete
            </p>
          </div>
          <h2 className="display mt-3 text-2xl font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[1.8rem]">
            {session.templateName}
          </h2>
          <p className="mt-1.5 text-xs text-muted">
            {formatDateKey(session.scheduledDate, "EEEE, MMMM d")} ·{" "}
            {formatDurationLong(recap.durationSeconds)}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              {
                label: "Volume",
                value: formatVolume(recap.volumeKg, recap.weightUnit),
                icon: Dumbbell,
                className: "col-span-2 sm:col-span-1",
              },
              {
                label: "Sets",
                value: `${recap.sets}`,
                icon: Check,
                className: "",
              },
              {
                label: "Reps",
                value: `${recap.reps}`,
                icon: TrendingUp,
                className: "",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-xl border border-white/[0.07] bg-white/[0.035] p-3",
                  stat.className,
                )}
              >
                <stat.icon className="size-3.5 text-muted-2" aria-hidden />
                <p className="tabular mt-2 truncate text-base font-semibold text-ink">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-2">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 text-[11px]">
            {volumeComparison === null ? (
              <span className="text-muted">
                First {session.templateName} on record. The baseline is set.
              </span>
            ) : volumeComparison > 0 ? (
              <>
                <TrendingUp className="size-3.5 shrink-0 text-lime" aria-hidden />
                <span className="text-muted">
                  <span className="font-semibold text-lime">
                    +{Math.abs(volumeComparison)}%
                  </span>{" "}
                  more volume than your last {session.templateName}
                </span>
              </>
            ) : volumeComparison < 0 ? (
              <>
                <TrendingDown className="size-3.5 shrink-0 text-warning" aria-hidden />
                <span className="text-muted">
                  <span className="font-semibold text-warning">
                    {Math.abs(volumeComparison)}%
                  </span>{" "}
                  below your last {session.templateName}. One session is noise.
                </span>
              </>
            ) : (
              <>
                <Minus className="size-3.5 shrink-0 text-muted-2" aria-hidden />
                <span className="text-muted">
                  Matched your last {session.templateName} volume.
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {recap.topLifts.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-2">
              Top 8-rep sets
            </p>
            <div className="mt-2 space-y-1.5">
              {recap.topLifts.slice(0, 3).map((lift) => {
                const delta = lift.deltaKg;
                return (
                  <div
                    key={lift.exerciseId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-canvas-soft/35 px-3 py-2.5"
                  >
                    <p className="min-w-0 truncate text-[12px] font-medium text-ink">
                      {lift.name}
                    </p>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-[12px] font-semibold text-ink">
                        {formatWeight(lift.bestWeightKg, recap.weightUnit)} ×{" "}
                        {lift.bestReps ?? "—"}
                      </p>
                      <p
                        className={cn(
                          "tabular mt-0.5 text-[10px]",
                          delta !== null && delta > 0
                            ? "text-lime"
                            : delta !== null && delta < 0
                              ? "text-warning"
                              : "text-muted-2",
                        )}
                      >
                        {delta === null
                          ? "new today"
                          : delta === 0
                            ? "matched previous"
                            : `${formatDeltaWeight(delta, recap.weightUnit)} vs last`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {recap.prGroups.length > 0 ? (
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="size-3.5 text-lime" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-2">
                New marks
              </p>
              <Badge variant="lime">{recap.prGroups.length} lifts</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recap.prGroups.slice(0, 4).map((group) => (
                <span
                  key={group.exerciseId ?? group.exerciseName}
                  className="min-w-0 rounded-full border border-lime/20 bg-lime/[0.055] px-2.5 py-1 text-[10px] text-muted"
                >
                  <span className="font-semibold text-ink">{group.exerciseName}</span>
                  {group.metrics[0] ? (
                    <>
                      {" "}
                      · {formatRecapPrMetric(group.metrics[0], recap.weightUnit)}
                    </>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-2 rounded-xl border border-dashed border-line bg-surface/40 p-3">
          <Clock3 className="mt-0.5 size-3.5 shrink-0 text-muted-2" aria-hidden />
          <div>
            <p className="text-[11px] leading-relaxed text-muted">{recap.focus}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-2">
              PRs and records were calculated from completed sets only.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <RecapButton
            label="Save recap"
            variant="primary"
            size="default"
            className="min-h-11 w-full sm:w-auto"
            session={session}
            previousSession={previousSession}
            sessions={sessions}
            records={records}
            measurements={measurements}
            definitions={definitions}
            schedule={schedule}
            profile={profile}
            today={today}
            dialogTitle="Today, in one look."
          />
          <Button asChild variant="secondary" className="min-h-11 w-full sm:w-auto">
            <Link href="/">
              Back to home
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
