"use client";

import * as React from "react";
import { onSnapshot } from "firebase/firestore";
import type { BodyMeasurement } from "@/domain/types";
import { bodyMeasurementSchema } from "@/domain/schemas";
import { getFirebaseClient } from "@/lib/firebase/client";
import { measurementsCollection } from "@/lib/firebase/paths";
import { useAuth } from "./use-auth";

interface MeasurementsContextValue {
  measurements: BodyMeasurement[];
  loading: boolean;
  error: string | null;
}

const MeasurementsContext =
  React.createContext<MeasurementsContextValue | null>(null);

export function MeasurementsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [measurements, setMeasurements] = React.useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = React.useState(Boolean(user));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMeasurements([]);
    setError(null);
    setLoading(Boolean(user));
    if (!user) {
      setLoading(false);
      return;
    }
    const client = getFirebaseClient();
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;
    const unsubscribe = onSnapshot(
      measurementsCollection(client.db, user.uid),
      (snapshot) => {
        if (!active) return;
        const parsed: BodyMeasurement[] = [];
        for (const document of snapshot.docs) {
          const result = bodyMeasurementSchema.safeParse(document.data());
          if (result.success) parsed.push(result.data);
        }
        parsed.sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
        );
        setMeasurements(parsed);
        setLoading(false);
      },
      (cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load measurements.");
        setLoading(false);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  const value = React.useMemo(
    () => ({ measurements, loading, error }),
    [measurements, loading, error],
  );

  return (
    <MeasurementsContext.Provider value={value}>
      {children}
    </MeasurementsContext.Provider>
  );
}

export function useMeasurements(): MeasurementsContextValue {
  const context = React.useContext(MeasurementsContext);
  if (!context) {
    throw new Error("useMeasurements must be used inside MeasurementsProvider");
  }
  return context;
}
