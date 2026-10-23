import {
  collection,
  getDocs,
  type CollectionReference,
} from "firebase/firestore";
import type {
  Achievement,
  BodyMeasurement,
  ExerciseDefinition,
  PersonalRecord,
  Preferences,
  Profile,
  ScheduleEntry,
  WorkoutSession,
  WorkoutTemplate,
} from "@/domain/types";
import { requireFirebaseClient } from "./client";
import {
  achievementsCollection,
  exerciseDefinitionsCollection,
  measurementsCollection,
  personalRecordsCollection,
  scheduleCollection,
  sessionsCollection,
  templatesCollection,
} from "./paths";

export interface ForgeExport {
  app: "FORGE";
  schemaVersion: number;
  exportedAt: string;
  user: { uid: string };
  profile: Profile | null;
  preferences: Preferences | null;
  exerciseDefinitions: ExerciseDefinition[];
  workoutTemplates: WorkoutTemplate[];
  weeklySchedule: ScheduleEntry[];
  workoutSessions: WorkoutSession[];
  bodyMeasurements: BodyMeasurement[];
  personalRecords: PersonalRecord[];
  achievements: Achievement[];
}

async function fetchCollection<T>(
  collectionRef: CollectionReference<T>,
): Promise<T[]> {
  const snapshot = await getDocs(collectionRef);
  return snapshot.docs.map((document) => document.data());
}

export async function buildUserExport(uid: string): Promise<ForgeExport> {
  const { db } = requireFirebaseClient();
  const [
    settingsSnapshot,
    exerciseDefinitions,
    workoutTemplates,
    weeklySchedule,
    workoutSessions,
    bodyMeasurements,
    personalRecords,
    achievements,
  ] = await Promise.all([
    getDocs(collection(db, "users", uid, "settings")),
    fetchCollection<ExerciseDefinition>(
      exerciseDefinitionsCollection(db, uid),
    ),
    fetchCollection<WorkoutTemplate>(templatesCollection(db, uid)),
    fetchCollection<ScheduleEntry>(scheduleCollection(db, uid)),
    fetchCollection<WorkoutSession>(sessionsCollection(db, uid)),
    fetchCollection<BodyMeasurement>(measurementsCollection(db, uid)),
    fetchCollection<PersonalRecord>(personalRecordsCollection(db, uid)),
    fetchCollection<Achievement>(achievementsCollection(db, uid)),
  ]);

  const settingsMap = new Map(
    settingsSnapshot.docs.map((document) => [document.id, document.data()]),
  );

  return {
    app: "FORGE",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user: { uid },
    profile: (settingsMap.get("profile") as Profile | undefined) ?? null,
    preferences:
      (settingsMap.get("preferences") as Preferences | undefined) ?? null,
    exerciseDefinitions,
    workoutTemplates,
    weeklySchedule,
    workoutSessions,
    bodyMeasurements,
    personalRecords,
    achievements,
  };
}

function csvEscape(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function workoutsToCsv(exportData: ForgeExport): string {
  const headers = [
    "session_id",
    "date",
    "template",
    "source",
    "status",
    "started_at",
    "completed_at",
    "duration_seconds",
    "exercise",
    "set_number",
    "weight_kg",
    "load_description",
    "load_basis",
    "reps",
    "set_status",
    "note",
  ];
  const rows: string[][] = [];
  for (const session of exportData.workoutSessions) {
    if (session.exercises.length === 0) {
      rows.push([
        session.id,
        session.scheduledDate,
        session.templateName,
        session.source,
        session.status,
        new Date(session.startedAt).toISOString(),
        session.completedAt ? new Date(session.completedAt).toISOString() : "",
        String(session.summary?.durationSeconds ?? ""),
        session.workoutType === "cardio" ? "Cardio" : "",
        "",
        "",
        "",
        "",
        "",
        session.notes,
      ]);
      continue;
    }
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        rows.push([
          session.id,
          session.scheduledDate,
          session.templateName,
          session.source,
          session.status,
          new Date(session.startedAt).toISOString(),
          session.completedAt
            ? new Date(session.completedAt).toISOString()
            : "",
          String(session.summary?.durationSeconds ?? ""),
          exercise.name,
          String(set.order + 1),
          set.weightKg === null ? "" : String(set.weightKg),
          set.loadDescription ?? "",
          set.loadBasis,
          set.reps === null ? "" : String(set.reps),
          set.status,
          set.note,
        ]);
      }
    }
  }
  return [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

export function measurementsToCsv(exportData: ForgeExport): string {
  const headers = ["id", "date", "metric", "label", "value", "unit", "notes"];
  const rows = exportData.bodyMeasurements.map((measurement) => [
    measurement.id,
    measurement.date,
    measurement.metric,
    measurement.label,
    String(measurement.value),
    measurement.unit,
    measurement.notes,
  ]);
  return [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain",
): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
