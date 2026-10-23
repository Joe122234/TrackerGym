import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import type {
  Achievement,
  BodyMeasurement,
  ExerciseDefinition,
  InitMeta,
  PersonalRecord,
  Preferences,
  Profile,
  ScheduleEntry,
  WorkoutSession,
  WorkoutTemplate,
} from "@/domain/types";

export function userRef(db: Firestore, uid: string): DocumentReference {
  return doc(db, "users", uid);
}

export function profileRef(
  db: Firestore,
  uid: string,
): DocumentReference<Profile> {
  return doc(db, "users", uid, "settings", "profile") as DocumentReference<Profile>;
}

export function preferencesRef(
  db: Firestore,
  uid: string,
): DocumentReference<Preferences> {
  return doc(
    db,
    "users",
    uid,
    "settings",
    "preferences",
  ) as DocumentReference<Preferences>;
}

export function initMetaRef(
  db: Firestore,
  uid: string,
): DocumentReference<InitMeta> {
  return doc(db, "users", uid, "meta", "initialization") as DocumentReference<InitMeta>;
}

export function templatesCollection(
  db: Firestore,
  uid: string,
): CollectionReference<WorkoutTemplate> {
  return collection(
    db,
    "users",
    uid,
    "workoutTemplates",
  ) as CollectionReference<WorkoutTemplate>;
}

export function templateRef(
  db: Firestore,
  uid: string,
  templateId: string,
): DocumentReference<WorkoutTemplate> {
  return doc(
    db,
    "users",
    uid,
    "workoutTemplates",
    templateId,
  ) as DocumentReference<WorkoutTemplate>;
}

export function exerciseDefinitionsCollection(
  db: Firestore,
  uid: string,
): CollectionReference<ExerciseDefinition> {
  return collection(
    db,
    "users",
    uid,
    "exerciseDefinitions",
  ) as CollectionReference<ExerciseDefinition>;
}

export function exerciseDefinitionRef(
  db: Firestore,
  uid: string,
  exerciseId: string,
): DocumentReference<ExerciseDefinition> {
  return doc(
    db,
    "users",
    uid,
    "exerciseDefinitions",
    exerciseId,
  ) as DocumentReference<ExerciseDefinition>;
}

export function scheduleCollection(
  db: Firestore,
  uid: string,
): CollectionReference<ScheduleEntry> {
  return collection(
    db,
    "users",
    uid,
    "weeklySchedule",
  ) as CollectionReference<ScheduleEntry>;
}

export function scheduleRef(
  db: Firestore,
  uid: string,
  day: string,
): DocumentReference<ScheduleEntry> {
  return doc(
    db,
    "users",
    uid,
    "weeklySchedule",
    day,
  ) as DocumentReference<ScheduleEntry>;
}

export function sessionsCollection(
  db: Firestore,
  uid: string,
): CollectionReference<WorkoutSession> {
  return collection(
    db,
    "users",
    uid,
    "workoutSessions",
  ) as CollectionReference<WorkoutSession>;
}

export function activeSessionRef(
  db: Firestore,
  uid: string,
): DocumentReference<WorkoutSession> {
  return doc(
    db,
    "users",
    uid,
    "workoutSessions",
    "active",
  ) as DocumentReference<WorkoutSession>;
}

export function sessionRef(
  db: Firestore,
  uid: string,
  sessionId: string,
): DocumentReference<WorkoutSession> {
  return doc(
    db,
    "users",
    uid,
    "workoutSessions",
    sessionId,
  ) as DocumentReference<WorkoutSession>;
}

export function measurementsCollection(
  db: Firestore,
  uid: string,
): CollectionReference<BodyMeasurement> {
  return collection(
    db,
    "users",
    uid,
    "bodyMeasurements",
  ) as CollectionReference<BodyMeasurement>;
}

export function measurementRef(
  db: Firestore,
  uid: string,
  measurementId: string,
): DocumentReference<BodyMeasurement> {
  return doc(
    db,
    "users",
    uid,
    "bodyMeasurements",
    measurementId,
  ) as DocumentReference<BodyMeasurement>;
}

export function personalRecordsCollection(
  db: Firestore,
  uid: string,
): CollectionReference<PersonalRecord> {
  return collection(
    db,
    "users",
    uid,
    "personalRecords",
  ) as CollectionReference<PersonalRecord>;
}

export function personalRecordRef(
  db: Firestore,
  uid: string,
  recordId: string,
): DocumentReference<PersonalRecord> {
  return doc(
    db,
    "users",
    uid,
    "personalRecords",
    recordId,
  ) as DocumentReference<PersonalRecord>;
}

export function achievementsCollection(
  db: Firestore,
  uid: string,
): CollectionReference<Achievement> {
  return collection(
    db,
    "users",
    uid,
    "achievements",
  ) as CollectionReference<Achievement>;
}

export function achievementRef(
  db: Firestore,
  uid: string,
  achievementId: string,
): DocumentReference<Achievement> {
  return doc(
    db,
    "users",
    uid,
    "achievements",
    achievementId,
  ) as DocumentReference<Achievement>;
}
