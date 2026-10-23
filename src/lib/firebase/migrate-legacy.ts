import { getAuth, type User } from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { SHARED_LOG_ID } from "@/config/user";
import { getFirebaseClient, USE_FIREBASE_EMULATORS } from "./client";
import {
  achievementsCollection,
  exerciseDefinitionsCollection,
  initMetaRef,
  measurementsCollection,
  personalRecordsCollection,
  preferencesRef,
  profileRef,
  scheduleCollection,
  sessionsCollection,
  templatesCollection,
} from "./paths";

const MIGRATION_KEY = "forge.sharedLogMigration.v1";
const WRITE_BATCH_SIZE = 400;

function readMigrationFlag(): boolean {
  try {
    return window.localStorage.getItem(MIGRATION_KEY) === "done";
  } catch {
    return false;
  }
}

function writeMigrationFlag(): void {
  try {
    window.localStorage.setItem(MIGRATION_KEY, "done");
  } catch {
    // The migration is idempotent; a missing flag only means it runs again.
  }
}

async function restoredLegacyUser(): Promise<User | null> {
  const client = getFirebaseClient();
  if (!client) return null;
  const auth = getAuth(client.app);

  await Promise.race([
    auth.authStateReady(),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 2500);
    }),
  ]).catch(() => undefined);

  return auth.currentUser;
}

async function copyCollectionMissing<T extends DocumentData>(
  db: Firestore,
  source: CollectionReference<T>,
  target: CollectionReference<T>,
): Promise<void> {
  const [sourceSnapshot, targetSnapshot] = await Promise.all([
    getDocs(source),
    getDocs(target),
  ]);
  const existingIds = new Set(
    targetSnapshot.docs.map((document) => document.id),
  );
  const missing = sourceSnapshot.docs.filter(
    (document) => !existingIds.has(document.id),
  );

  for (let index = 0; index < missing.length; index += WRITE_BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const document of missing.slice(index, index + WRITE_BATCH_SIZE)) {
      batch.set(collectionDocument(target, document), document.data());
    }
    await batch.commit();
  }
}

function collectionDocument<T extends DocumentData>(
  target: CollectionReference<T>,
  source: QueryDocumentSnapshot<T>,
): DocumentReference<T> {
  return doc(target, source.id);
}

async function copyDocumentMissing<T extends DocumentData>(
  source: DocumentReference<T>,
  target: DocumentReference<T>,
): Promise<void> {
  const [sourceSnapshot, targetSnapshot] = await Promise.all([
    getDoc(source),
    getDoc(target),
  ]);
  if (sourceSnapshot.exists() && !targetSnapshot.exists()) {
    await setDoc(target, sourceSnapshot.data());
  }
}

/**
 * The previous build created a different hidden anonymous Firebase account in
 * every browser. Before switching to the shared log, copy any data left by that
 * session into `users/{SHARED_LOG_ID}` so the laptop's existing workout is not
 * stranded. This is idempotent and only copies missing documents.
 */
export async function migrateLegacyLogIfNeeded(): Promise<void> {
  if (typeof window === "undefined" || USE_FIREBASE_EMULATORS) return;
  if (readMigrationFlag()) return;

  const client = getFirebaseClient();
  if (!client) return;

  try {
    const legacyUser = await restoredLegacyUser();
    if (!legacyUser || legacyUser.uid === SHARED_LOG_ID) {
      writeMigrationFlag();
      return;
    }

    const legacyUid = legacyUser.uid;
    const db = client.db;

    await Promise.all([
      copyDocumentMissing(
        profileRef(db, legacyUid),
        profileRef(db, SHARED_LOG_ID),
      ),
      copyDocumentMissing(
        preferencesRef(db, legacyUid),
        preferencesRef(db, SHARED_LOG_ID),
      ),
      copyDocumentMissing(
        initMetaRef(db, legacyUid),
        initMetaRef(db, SHARED_LOG_ID),
      ),
      copyCollectionMissing(
        db,
        exerciseDefinitionsCollection(db, legacyUid),
        exerciseDefinitionsCollection(db, SHARED_LOG_ID),
      ),
      copyCollectionMissing(
        db,
        templatesCollection(db, legacyUid),
        templatesCollection(db, SHARED_LOG_ID),
      ),
      copyCollectionMissing(
        db,
        scheduleCollection(db, legacyUid),
        scheduleCollection(db, SHARED_LOG_ID),
      ),
      copyCollectionMissing(
        db,
        sessionsCollection(db, legacyUid),
        sessionsCollection(db, SHARED_LOG_ID),
      ),
      copyCollectionMissing(
        db,
        measurementsCollection(db, legacyUid),
        measurementsCollection(db, SHARED_LOG_ID),
      ),
      copyCollectionMissing(
        db,
        personalRecordsCollection(db, legacyUid),
        personalRecordsCollection(db, SHARED_LOG_ID),
      ),
      copyCollectionMissing(
        db,
        achievementsCollection(db, legacyUid),
        achievementsCollection(db, SHARED_LOG_ID),
      ),
    ]);

    writeMigrationFlag();
  } catch (error) {
    // Do not mark a failed migration complete. The next load will retry after
    // the Firestore rules allow the shared path.
    console.warn("Existing log migration did not finish.", error);
  }
}
