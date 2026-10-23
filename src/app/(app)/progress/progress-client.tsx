"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Gauge,
  History,
  Moon,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Achievement,
  AttendanceDay,
  PersonalRecord,
  WeightUnit,
} from "@/domain/types";
import {
  addDaysToKey,
  addMonthsToKey,
  buildAttendance,
  calculateStreakStats,
  dateKeyInTimeZone,
  formatDateKey,
  formatTimestamp,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
} from "@/domain/dates";
import { getSessionSetCounts, getTotalVolumeKg } from "@/domain/workout";
import {
  formatVolume,
  formatWeight,
  kgToDisplay,
} from "@/domain/units";
import { prMetricLabel } from "@/domain/records";
import { markAchievementSeen } from "@/lib/firebase/derived";
import { useAuth } from "@/hooks/use-auth";
import { useDerived } from "@/hooks/use-derived";
import { useSessions } from "@/hooks/use-sessions";
import { useUserData } from "@/hooks/use-user-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  MetricRing,
  PageHeader,
  SectionHeading,
  StatTile,
} from "@/components/ui/layout";

function monthStats(
  days: AttendanceDay[],
  sessions: ReturnType<typeof useSessions>["sessions"],
  month: string,
  startDate: string,
  today: string,
) {
  const inMonth = days.filter(
    (day) =>
      day.date.startsWith(month.slice(0, 7)) &&
      day.date >= startDate &&
      day.date <= today,
  );
  const training = inMonth.filter((day) => day.kind === "training");
  const completed = training.filter((day) => day.status === "completed");
  const monthSessions = sessions.filter(
    (session) =>
      session.scheduledDate.startsWith(month.slice(0, 7)) &&
      session.scheduledDate >= startDate,
  );
  return {
    planned: training.length,
    completed: completed.length,
    sessions: monthSessions.length,
    consistency:
      completed.length + training.filter((day) => day.status === "missed").length >
      0
        ? Math.round(
            (completed.length /
              (completed.length +
                training.filter((day) => day.status === "missed").length)) *
              100,
          )
        : null,
  };
}

function recordValue(record: PersonalRecord, unit: WeightUnit): string {
  if (
    record.metric === "maxWeight" ||
    record.metric === "estimated1RM"
  ) {
    return formatWeight(record.value, unit);
  }
  if (record.metric === "repsAtWeight") {
    return `${record.reps ?? "—"} reps @ ${
      record.weightKg === null ? "—" : formatWeight(record.weightKg, unit)
    }`;
  }
  if (
    record.metric === "exerciseVolume" ||
    record.metric === "sessionVolume"
  ) {
    return formatVolume(record.value, unit);
  }
  return `${record.value} ${record.unit}`.trim();
}

const ACHIEVEMENT_ICONS = {
  workout: Dumbbell,
  streak: Flame,
  record: Trophy,
  consistency: Target,
  exercise: Award,
} as const;

function AchievementCard({
  achievement,
  timezone,
}: {
  achievement: Achievement;
  timezone: string;
}) {
  const Icon = ACHIEVEMENT_ICONS[achievement.category] ?? Award;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4",
        achievement.seenAt
          ? "border-line bg-surface"
          : "border-lime/20 bg-lime/[0.035]",
      )}
    >
      {!achievement.seenAt ? (
        <span className="absolute right-3 top-3 size-1.5 rounded-full bg-lime" />
      ) : null}
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl border",
          achievement.seenAt
            ? "border-line bg-elevated text-muted"
            : "border-lime/25 bg-lime/10 text-lime",
        )}
      >
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-[12px] font-semibold text-ink">
        {achievement.title}
      </p>
      <p className="mt-1 text-[10px] leading-relaxed text-muted">
        {achievement.description}
      </p>
      <p className="mt-2.5 text-[9px] uppercase tracking-[0.1em] text-muted-2">
        {formatTimestamp(achievement.earnedAt, timezone, "MMM d, yyyy")}
      </p>
    </div>
  );
}

export function ProgressClient() {
  const { user } = useAuth();
  const { profile, schedule } = useUserData();
  const { sessions, loading: sessionsLoading } = useSessions();
  const { records, achievements, loading: derivedLoading } = useDerived();
  const [now] = React.useState(() => Date.now());
  const timezone = profile?.timezone ?? "Asia/Bangkok";
  const today = todayKey(timezone, now);
  const currentMonth = startOfMonthKey(today);
  const [month, setMonth] = React.useState(currentMonth);
  const unit = profile?.weightUnit ?? "kg";
  const seenSyncRef = React.useRef(new Set<string>());
  const createdDate = dateKeyInTimeZone(profile?.createdAt ?? now, timezone);
  const dayStart = React.useMemo(() => {
    const earliestSession = [...sessions]
      .map((session) => session.scheduledDate)
      .sort()[0];
    return earliestSession && earliestSession < createdDate
      ? earliestSession
      : createdDate;
  }, [sessions, createdDate]);

  const allAttendance = React.useMemo(
    () => buildAttendance(dayStart, today, today, schedule, sessions),
    [dayStart, today, schedule, sessions],
  );
  const streak = React.useMemo(
    () => calculateStreakStats(allAttendance, today, startOfWeekKey(today)),
    [allAttendance, today],
  );

  const monthDays = React.useMemo(() => {
    const first = month;
    const firstDay = new Date(`${first}T00:00:00Z`).getUTCDay();
    const leading = firstDay === 0 ? 6 : firstDay - 1;
    const gridStart = addDaysToKey(first, -leading);
    return buildAttendance(
      gridStart,
      addDaysToKey(gridStart, 41),
      today,
      schedule,
      sessions,
    );
  }, [month, today, schedule, sessions]);
  const stats = monthStats(monthDays, sessions, month, createdDate, today);

  const volumeData = React.useMemo(() => {
    const currentWeek = startOfWeekKey(today);
    return Array.from({ length: 8 }, (_, index) => {
      const weekStart = addDaysToKey(currentWeek, (index - 7) * 7);
      const weekEnd = addDaysToKey(weekStart, 6);
      const weekSessions = sessions.filter(
        (session) =>
          session.scheduledDate >= weekStart &&
          session.scheduledDate <= weekEnd,
      );
      const total = weekSessions.reduce(
        (sum, session) =>
          sum +
          (session.summary?.totalVolumeKg ?? getTotalVolumeKg(session)),
        0,
      );
      return {
        week: formatDateKey(weekStart, "MMM d"),
        volume: Math.round(kgToDisplay(total, unit)),
        sessions: weekSessions.length,
      };
    });
  }, [sessions, today, unit]);

  const hasVolume = volumeData.some((week) => week.volume > 0);
  const topRecords = React.useMemo(() => {
    const priority = {
      maxWeight: 0,
      estimated1RM: 1,
      repsAtWeight: 2,
      exerciseVolume: 3,
      sessionVolume: 4,
      targetPerformance: 5,
    };
    return [...records]
      .sort((a, b) => {
        const diff =
          priority[a.metric] - priority[b.metric] ||
          b.achievedAt - a.achievedAt;
        return diff;
      })
      .slice(0, 8);
  }, [records]);

  React.useEffect(() => {
    if (!user) return;
    for (const achievement of achievements) {
      if (achievement.seenAt) continue;
      if (seenSyncRef.current.has(achievement.id)) continue;
      seenSyncRef.current.add(achievement.id);
      void markAchievementSeen(user.uid, achievement.id).catch(() => {
        seenSyncRef.current.delete(achievement.id);
      });
    }
  }, [user, achievements]);

  const monthLabel = formatDateKey(`${month.slice(0, 7)}-01`, "MMMM yyyy");
  const canGoForward = month < currentMonth;
  const trainingDays = monthDays.filter(
    (day) =>
      day.kind === "training" &&
      day.date.startsWith(month.slice(0, 7)) &&
      day.date >= createdDate &&
      day.date <= today,
  ).length;
  const monthVolume = sessions
    .filter((session) => session.scheduledDate.startsWith(month.slice(0, 7)))
    .reduce(
      (sum, session) =>
        sum + (session.summary?.totalVolumeKg ?? getTotalVolumeKg(session)),
      0,
    );
  const totalSets = sessions.reduce(
    (sum, session) => sum + getSessionSetCounts(session).completed,
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Progress"
        title="The record"
        description="Consistency, real PRs, and every completed session. Rest days are exempt from streaks; nothing here is estimated."
        actions={
          <Button asChild variant="secondary">
            <Link href="/workouts/?tab=history">
              <History /> Session history
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Current streak"
          value={`${streak.current}`}
          hint="Training days in a row · rest exempt"
          icon={<Flame className="size-4" />}
          accent="lime"
        />
        <StatTile
          label="Longest streak"
          value={`${streak.longest}`}
          hint="From completed sessions"
          icon={<Award className="size-4" />}
        />
        <StatTile
          label="Completed"
          value={sessions.length}
          hint={`${totalSets} sets logged`}
          icon={<Dumbbell className="size-4" />}
          accent="violet"
        />
        <StatTile
          label="Personal records"
          value={records.length}
          hint="Derived from finished sets"
          icon={<Trophy className="size-4" />}
          accent="blue"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Volume trend</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Last 8 weeks · numeric sets only
              </p>
            </div>
            <Badge variant="outline">{unit}·reps</Badge>
          </div>
          {!hasVolume ? (
            <div className="mt-4 flex h-52 items-center justify-center rounded-xl border border-dashed border-line bg-canvas-soft/35 px-6 text-center">
              <p className="text-sm leading-relaxed text-muted">
                Complete a strength session to start the volume trend. No
                placeholder data is drawn.
              </p>
            </div>
          ) : (
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={volumeData}
                  margin={{ top: 8, right: 4, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="forge-volume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C5F467" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#C5F467" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="#242a31"
                    strokeDasharray="3 4"
                  />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: "#7d8794", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fill: "#69737f", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <Tooltip
                    cursor={{ stroke: "#39404a", strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "#14181d",
                      border: "1px solid #2a3038",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "#eef1f4",
                    }}
                    labelStyle={{ color: "#9aa4b1", marginBottom: 4 }}
                    formatter={(value) => [
                      `${Number(value).toLocaleString()} ${unit}·reps`,
                      "Volume",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#C5F467"
                    strokeWidth={2}
                    fill="url(#forge-volume)"
                    dot={{ r: 2, fill: "#C5F467", strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: "#C5F467", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="flex flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">This week</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Due sessions only
              </p>
            </div>
            <Gauge className="size-4 text-lime/70" />
          </div>
          <div className="mt-4 flex flex-1 items-center gap-4">
            <MetricRing
              value={streak.weeklyConsistency}
              size={88}
              stroke={7}
              label="Weekly consistency"
              sublabel="done"
            />
            <div className="min-w-0 space-y-2 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Completed</span>
                <span className="tabular font-semibold text-ink">
                  {streak.completedThisWeek}/{streak.plannedThisWeek}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Due so far</span>
                <span className="tabular font-semibold text-ink">
                  {streak.dueThisWeek}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Extra sessions</span>
                <span className="tabular font-semibold text-ink">
                  {streak.extraSessionsThisWeek}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-4 border-t border-line/60 pt-3 text-[10px] leading-relaxed text-muted-2">
            Rest days are skipped entirely. An unfinished today does not break
            the prior streak.
          </p>
        </Card>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <CalendarDays className="size-4 text-muted-2" /> {monthLabel}
              </h2>
              <p className="mt-0.5 text-[10px] text-muted-2">
                {stats.sessions} session{stats.sessions === 1 ? "" : "s"} ·{" "}
                {formatVolume(monthVolume, unit)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setMonth((value) => addMonthsToKey(value, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setMonth((value) => addMonthsToKey(value, 1))}
                disabled={!canGoForward}
                aria-label="Next month"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="pb-1 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-2"
              >
                {day}
              </div>
            ))}
            {monthDays.map((day) => {
              const outside = !day.date.startsWith(month.slice(0, 7));
              const beforeStart = day.date < createdDate;
              const session =
                day.sessionIds.length > 0
                  ? sessions.find((candidate) => candidate.id === day.sessionIds[0])
                  : null;
              const cell = (
                <div
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[10px] transition-colors",
                    outside && "opacity-30",
                    beforeStart &&
                      "border-line/20 bg-transparent text-muted-2/40",
                    !beforeStart &&
                      day.status === "completed" &&
                      "border-lime/25 bg-lime/[0.07] text-lime",
                    !beforeStart &&
                      day.status === "missed" &&
                      "border-danger/15 bg-danger/[0.035] text-danger/80",
                    !beforeStart &&
                      day.status === "today" &&
                      "border-lime/45 bg-lime/[0.05] text-ink",
                    !beforeStart &&
                      day.status === "rest" &&
                      "border-line/30 bg-transparent text-muted-2",
                    !beforeStart &&
                      day.status === "upcoming" &&
                      "border-line/40 bg-canvas-soft/30 text-muted-2",
                  )}
                >
                  <span className="tabular font-medium">{Number(day.date.slice(8))}</span>
                  {beforeStart ? null : day.kind === "rest" ? (
                    <Moon className="mt-0.5 size-2.5 opacity-60" />
                  ) : day.status === "completed" ? (
                    <span className="mt-1 size-1 rounded-full bg-lime" />
                  ) : day.status === "missed" ? (
                    <span className="mt-1 size-1 rounded-full bg-danger/70" />
                  ) : day.status === "today" ? (
                    <span className="mt-1 size-1 rounded-full bg-lime/70" />
                  ) : null}
                </div>
              );
              return session ? (
                <Link
                  key={day.date}
                  href={`/workouts/session/?id=${encodeURIComponent(session.id)}`}
                  className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lime/60"
                  aria-label={`${formatDateKey(day.date, "MMMM d")} · ${session.templateName}`}
                >
                  {cell}
                </Link>
              ) : (
                <div key={day.date}>{cell}</div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line/60 pt-3 text-[9px] text-muted-2">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-lime" /> Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-danger/70" /> Missed
            </span>
            <span className="flex items-center gap-1.5">
              <Moon className="size-2.5" /> Rest
            </span>
            <span className="ml-auto">
              {stats.completed}/{trainingDays} training days completed
            </span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Trophy className="size-4 text-lime/80" /> Personal records
            </h2>
            <Link
              href="/progress/#records"
              className="text-[10px] text-muted-2 hover:text-ink"
            >
              All records
            </Link>
          </div>
          {derivedLoading ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          ) : topRecords.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-line bg-canvas-soft/30 px-4 py-8 text-center">
              <Sparkles className="mx-auto size-4 text-muted-2" />
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Complete a strength session to establish your first real PR.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-1.5" id="records">
              {topRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-2.5 rounded-xl border border-line/60 bg-canvas-soft/30 px-3 py-2.5"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-lime/15 bg-lime/[0.07] text-lime">
                    <Trophy className="size-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-ink">
                      {record.exerciseName || "Session"}
                    </p>
                    <p className="truncate text-[9px] text-muted-2">
                      {prMetricLabel(record.metric)} ·{" "}
                      {formatDateKey(record.scheduledDate, "MMM d")}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-[11px] font-semibold text-lime">
                    {recordValue(record, unit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-7">
        <SectionHeading
          title="Achievements"
          description="Milestones earned from completed sessions, never from planned work."
          action={
            <Badge variant="outline">
              {achievements.length} earned
            </Badge>
          }
        />
        {derivedLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="skeleton h-36 rounded-2xl" />
            ))}
          </div>
        ) : achievements.length === 0 ? (
          <EmptyState
            compact
            icon={<Award className="size-5" />}
            title="No achievements yet"
            description="Your first completed session will start the record. Achievements are derived from what you actually finish."
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/workouts/?tab=schedule">
                  Open my split <ArrowRight />
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {achievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                timezone={timezone}
              />
            ))}
          </div>
        )}
      </div>

      {sessionsLoading ? (
        <p className="mt-6 text-center text-[10px] text-muted-2">
          Refreshing completed sessions…
        </p>
      ) : null}
    </div>
  );
}
