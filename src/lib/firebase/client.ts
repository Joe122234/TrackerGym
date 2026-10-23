import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import { PUBLIC_FIREBASE_CONFIG } from "./public-config";

export const USE_FIREBASE_EMULATORS =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

// Public web config is committed so a clean checkout works without manual
// environment setup. Every value can still be overridden for a different
// Firebase project or for the emulator suite.
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || PUBLIC_FIREBASE_CONFIG.apiKey,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    PUBLIC_FIREBASE_CONFIG.authDomain,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    PUBLIC_FIREBASE_CONFIG.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    PUBLIC_FIREBASE_CONFIG.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    PUBLIC_FIREBASE_CONFIG.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || PUBLIC_FIREBASE_CONFIG.appId,
};

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  appCheck: AppCheck | null;
}

interface FirebaseGlobal {
  forgeClient?: FirebaseClient;
  forgeAuthEmulatorConnected?: boolean;
  forgeFirestoreEmulatorConnected?: boolean;
}

const globalForFirebase = globalThis as typeof globalThis & FirebaseGlobal;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

export function getFirebaseClient(): FirebaseClient | null {
  if (typeof window === "undefined" || !isFirebaseConfigured()) {
    return null;
  }
  if (globalForFirebase.forgeClient) return globalForFirebase.forgeClient;

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });

  let appCheck: AppCheck | null = null;
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (siteKey && !USE_FIREBASE_EMULATORS) {
    const debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (debugToken) {
      (
        self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }
      ).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  if (USE_FIREBASE_EMULATORS) {
    if (!globalForFirebase.forgeAuthEmulatorConnected) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      globalForFirebase.forgeAuthEmulatorConnected = true;
    }
    if (!globalForFirebase.forgeFirestoreEmulatorConnected) {
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      globalForFirebase.forgeFirestoreEmulatorConnected = true;
    }
  }

  void setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Unable to set auth persistence", error);
  });

  const client: FirebaseClient = { app, auth, db, appCheck };
  globalForFirebase.forgeClient = client;
  return client;
}

export function requireFirebaseClient(): FirebaseClient {
  const client = getFirebaseClient();
  if (!client) {
    throw new Error(
      "Firebase is not configured. Add the public Firebase web configuration to src/lib/firebase/public-config.ts or the NEXT_PUBLIC_FIREBASE_* environment variables.",
    );
  }
  return client;
}

export const firebaseProjectId = firebaseConfig.projectId;
