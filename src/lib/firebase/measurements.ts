import { deleteDoc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import type { BodyMeasurement } from "@/domain/types";
import { bodyMeasurementSchema } from "@/domain/schemas";
import { makeId } from "@/domain/workout";
import { requireFirebaseClient } from "./client";
import { measurementRef, measurementsCollection } from "./paths";

export async function fetchMeasurements(
  uid: string,
): Promise<BodyMeasurement[]> {
  const { db } = requireFirebaseClient();
  const snapshot = await getDocs(
    query(measurementsCollection(db, uid), orderBy("date", "desc")),
  );
  return snapshot.docs
    .map((document) => bodyMeasurementSchema.safeParse(document.data()))
    .filter((result) => result.success)
    .map((result) => result.data)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export async function upsertMeasurement(
  uid: string,
  values: {
    id?: string;
    metric: string;
    label: string;
    date: string;
    value: number;
    unit: "kg" | "cm";
    notes: string;
    isCustom: boolean;
    createdAt?: number;
  },
): Promise<BodyMeasurement> {
  const { db } = requireFirebaseClient();
  const now = Date.now();
  const measurement: BodyMeasurement = {
    id: values.id ?? makeId("measure"),
    metric: values.metric,
    label: values.label.trim(),
    date: values.date,
    value: values.value,
    unit: values.unit,
    notes: values.notes.trim(),
    isCustom: values.isCustom,
    createdAt: values.createdAt ?? now,
    updatedAt: now,
  };
  const parsed = bodyMeasurementSchema.safeParse(measurement);
  if (!parsed.success) throw new Error("Measurement details are not valid.");
  await setDoc(measurementRef(db, uid, measurement.id), parsed.data);
  return parsed.data;
}

export async function deleteMeasurement(
  uid: string,
  measurementId: string,
): Promise<void> {
  const { db } = requireFirebaseClient();
  await deleteDoc(measurementRef(db, uid, measurementId));
}
