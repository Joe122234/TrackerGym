import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-forge",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

function profile(uid: string) {
  return {
    displayName: `Athlete ${uid}`,
    heightCm: 180,
    weightKg: 80,
    weightUnit: "kg",
    measurementUnit: "cm",
    timezone: "Asia/Bangkok",
    theme: "dark",
    createdAt: 1_767_600_000_000,
    updatedAt: 1_767_600_000_000,
  };
}

describe("per-user Firestore rules", () => {
  it("allows the owner to read and write their profile", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertSucceeds(
      setDoc(doc(db, "users", "user-a", "settings", "profile"), profile("a")),
    );
    await assertSucceeds(
      getDoc(doc(db, "users", "user-a", "settings", "profile")),
    );
  });

  it("denies another signed-in user from reading or writing the owner's profile", async () => {
    const ownerDb = testEnv.authenticatedContext("user-a").firestore();
    await ownerDb
      .collection("users")
      .doc("user-a")
      .collection("settings")
      .doc("profile")
      .set(profile("a"));

    const otherDb = testEnv.authenticatedContext("user-b").firestore();
    await assertFails(
      getDoc(doc(otherDb, "users", "user-a", "settings", "profile")),
    );
    await assertFails(
      setDoc(doc(otherDb, "users", "user-a", "settings", "profile"), profile("b")),
    );
  });

  it("denies anonymous access", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(db, "users", "user-a", "settings", "profile")),
    );
    await assertFails(
      setDoc(doc(db, "users", "user-a", "workoutTemplates", "t1"), {
        name: "Injected",
      }),
    );
  });

  it("allows workout sessions, measurements, and derived records for the owner", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertSucceeds(
      setDoc(doc(db, "users", "user-a", "workoutSessions", "active"), {
        status: "active",
        startedAt: 10,
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "users", "user-a", "workoutSessions", "session_1"), {
        status: "completed",
        startedAt: 10,
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "users", "user-a", "bodyMeasurements", "m1"), {
        metric: "bodyWeight",
        value: 80,
        unit: "kg",
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "users", "user-a", "personalRecords", "pr1"), {
        metric: "maxWeight",
        value: 100,
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "users", "user-a", "achievements", "a1"), {
        key: "first_workout",
      }),
    );
    await assertSucceeds(
      getDoc(doc(db, "users", "user-a", "workoutSessions", "session_1")),
    );
    await assertSucceeds(deleteDoc(doc(db, "users", "user-a", "bodyMeasurements", "m1")));
  });

  it("allows only the owner's own completed-session query", async () => {
    const ownerDb = testEnv.authenticatedContext("user-a").firestore();
    await setDoc(doc(ownerDb, "users", "user-a", "workoutSessions", "s1"), {
      status: "completed",
      startedAt: 100,
    });
    await setDoc(doc(ownerDb, "users", "user-a", "workoutSessions", "s2"), {
      status: "active",
      startedAt: 200,
    });
    await assertSucceeds(
      getDocs(
        query(
          collection(ownerDb, "users", "user-a", "workoutSessions"),
          where("status", "==", "completed"),
        ),
      ),
    );

    const otherDb = testEnv.authenticatedContext("user-b").firestore();
    await assertFails(
      getDocs(
        query(
          collection(otherDb, "users", "user-a", "workoutSessions"),
          where("status", "==", "completed"),
        ),
      ),
    );
  });

  it("denies unknown subcollections and reserved settings documents", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(
      setDoc(doc(db, "users", "user-a", "secrets", "token"), { value: "x" }),
    );
    await assertFails(
      setDoc(doc(db, "users", "user-a", "settings", "privileges"), {
        admin: true,
      }),
    );
  });

  it("does not expose a global collection outside the user namespace", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(getDoc(doc(db, "publicUsers", "user-a")));
    await assertFails(setDoc(doc(db, "publicUsers", "user-a"), { admin: true }));
  });
});
