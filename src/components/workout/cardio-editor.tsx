"use client";

import * as React from "react";
import {
  Activity,
  Clock3,
  Gauge,
  HeartPulse,
  MapPin,
  Mountain,
  StickyNote,
} from "lucide-react";
import type { CardioRecord } from "@/domain/types";
import { parseNumericInput, round, secondsToPace } from "@/domain/units";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CardioForm {
  activityType: string;
  minutes: string;
  seconds: string;
  distanceKm: string;
  inclinePercent: string;
  speedKph: string;
  equipment: string;
  notes: string;
  intensity: number | null;
}

const ACTIVITIES = [
  "Treadmill",
  "Outdoor Run",
  "Walk",
  "Cycling",
  "Stair Climber",
  "Rowing",
  "Elliptical",
  "Swim",
];

function formFromRecord(record: CardioRecord): CardioForm {
  const duration = record.durationSeconds ?? 0;
  return {
    activityType: record.activityType,
    minutes: duration > 0 ? String(Math.floor(duration / 60)) : "",
    seconds: duration > 0 ? String(duration % 60) : "",
    distanceKm:
      record.distanceKm === null ? "" : String(round(record.distanceKm, 3)),
    inclinePercent:
      record.inclinePercent === null
        ? ""
        : String(round(record.inclinePercent, 2)),
    speedKph:
      record.speedKph === null ? "" : String(round(record.speedKph, 2)),
    equipment: record.equipment,
    notes: record.notes,
    intensity: record.intensity,
  };
}

function parseOptional(value: string): number | null {
  const parsed = parseNumericInput(value);
  return parsed === null ? null : parsed;
}

function toRecord(form: CardioForm): CardioRecord {
  const minutes = parseOptional(form.minutes) ?? 0;
  const seconds = parseOptional(form.seconds) ?? 0;
  const duration =
    minutes > 0 || seconds > 0
      ? Math.max(0, Math.round(minutes * 60 + seconds))
      : null;
  const distance = parseOptional(form.distanceKm);
  const incline = parseOptional(form.inclinePercent);
  const speed = parseOptional(form.speedKph);
  return {
    activityType: form.activityType.trim().slice(0, 80),
    durationSeconds: duration,
    distanceKm: distance === null ? null : round(Math.max(0, distance), 3),
    avgPaceSecondsPerKm:
      duration && distance !== null && distance > 0
        ? Math.round(duration / distance)
        : null,
    inclinePercent: incline === null ? null : Math.max(0, round(incline, 2)),
    speedKph: speed === null ? null : Math.max(0, round(speed, 2)),
    equipment: form.equipment.trim().slice(0, 120),
    notes: form.notes.slice(0, 2000),
    intensity: form.intensity,
  };
}

export function CardioEditor({
  record,
  onChange,
}: {
  record: CardioRecord;
  onChange: (record: CardioRecord) => void;
}) {
  const [form, setForm] = React.useState<CardioForm>(() =>
    formFromRecord(record),
  );

  const update = (patch: Partial<CardioForm>) => {
    const next = { ...form, ...patch };
    setForm(next);
    onChange(toRecord(next));
  };

  const preview = toRecord(form);
  const pace = secondsToPace(preview.avgPaceSecondsPerKm);

  return (
    <div className="space-y-4">
      <section className="rounded-panel border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <HeartPulse className="size-4 text-blue" />
          <h2 className="text-[13px] font-semibold text-ink">Cardio session</h2>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Log what you actually did. All fields except activity are optional,
          but duration or distance is needed to finish.
        </p>

        <div className="mt-4 space-y-2">
          <Label className="text-[10px]">Activity</Label>
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITIES.map((activity) => (
              <button
                key={activity}
                type="button"
                onClick={() => update({ activityType: activity })}
                className={cn(
                  "rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors",
                  form.activityType === activity
                    ? "border-blue/40 bg-blue/10 text-blue"
                    : "border-line bg-canvas-soft text-muted hover:text-ink",
                )}
              >
                {activity}
              </button>
            ))}
          </div>
          <Input
            value={form.activityType}
            onChange={(event) => update({ activityType: event.target.value })}
            placeholder="Or type another activity"
            maxLength={80}
            className="mt-2 bg-canvas-soft"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[10px]">
              <Clock3 className="size-3" /> Minutes
            </Label>
            <Input
              inputMode="numeric"
              value={form.minutes}
              onChange={(event) => update({ minutes: event.target.value })}
              placeholder="0"
              className="tabular h-11 bg-canvas-soft text-center"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px]">Seconds</Label>
            <Input
              inputMode="numeric"
              value={form.seconds}
              onChange={(event) => update({ seconds: event.target.value })}
              placeholder="0"
              className="tabular h-11 bg-canvas-soft text-center"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[10px]">
              <MapPin className="size-3" /> Distance (km)
            </Label>
            <Input
              inputMode="decimal"
              value={form.distanceKm}
              onChange={(event) => update({ distanceKm: event.target.value })}
              placeholder="—"
              className="tabular h-11 bg-canvas-soft text-center"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[10px]">
              <Gauge className="size-3" /> Speed (km/h)
            </Label>
            <Input
              inputMode="decimal"
              value={form.speedKph}
              onChange={(event) => update({ speedKph: event.target.value })}
              placeholder="—"
              className="tabular h-11 bg-canvas-soft text-center"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[10px]">
              <Mountain className="size-3" /> Incline (%)
            </Label>
            <Input
              inputMode="decimal"
              value={form.inclinePercent}
              onChange={(event) => update({ inclinePercent: event.target.value })}
              placeholder="—"
              className="tabular h-11 bg-canvas-soft text-center"
            />
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-[10px]">Average pace</Label>
            <div className="tabular flex h-11 items-center justify-center rounded-xl border border-line bg-canvas-soft text-[13px] text-muted">
              {pace}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[10px]">
              <Activity className="size-3" /> Intensity
            </Label>
            <div className="flex h-11 items-center gap-1 rounded-xl border border-line bg-canvas-soft px-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() =>
                    update({
                      intensity: form.intensity === level ? null : level,
                    })
                  }
                  className={cn(
                    "flex h-7 flex-1 items-center justify-center rounded text-[9px] font-semibold transition-colors",
                    form.intensity === level
                      ? "bg-blue text-canvas"
                      : "text-muted-2 hover:bg-elevated hover:text-ink",
                  )}
                  aria-label={`Intensity ${level} of 10`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px]">Equipment</Label>
            <Input
              value={form.equipment}
              onChange={(event) => update({ equipment: event.target.value })}
              placeholder="Treadmill 4, bike 2…"
              maxLength={120}
              className="bg-canvas-soft"
            />
          </div>
          <div className="space-y-1.5 sm:row-span-2">
            <Label className="flex items-center gap-1.5 text-[10px]">
              <StickyNote className="size-3" /> Notes
            </Label>
            <textarea
              value={form.notes}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="How did it feel? Terrain, intervals, effort…"
              rows={4}
              maxLength={2000}
              className="min-h-[92px] w-full resize-y rounded-xl border border-line bg-canvas-soft px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-muted-2/70 focus:border-lime/60 focus:ring-2 focus:ring-lime/10"
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Duration",
            value:
              preview.durationSeconds === null
                ? "—"
                : `${Math.floor(preview.durationSeconds / 60)}:${String(
                    preview.durationSeconds % 60,
                  ).padStart(2, "0")}`,
          },
          {
            label: "Distance",
            value:
              preview.distanceKm === null
                ? "—"
                : `${round(preview.distanceKm, 2)} km`,
          },
          { label: "Pace", value: pace.replace(" /km", "") },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-line bg-canvas-soft/50 p-3 text-center"
          >
            <p className="text-[9px] uppercase tracking-[0.12em] text-muted-2">
              {item.label}
            </p>
            <p className="tabular mt-1 text-sm font-semibold text-ink">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
