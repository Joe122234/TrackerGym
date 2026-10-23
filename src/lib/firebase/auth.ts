import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseProjectId, requireFirebaseClient } from "./client";

export async function subscribeToAuth(
  callback: (user: User | null) => void,
): Promise<() => void> {
  const { auth } = requireFirebaseClient();
  return onAuthStateChanged(auth, callback);
}

/**
 * Creates the invisible single-user session. Firebase Auth treats this as a
 * real authenticated identity, but FORGE never asks the owner to sign in.
 * Firebase Auth's default local persistence restores it across reloads.
 */
export async function ensureAnonymousAuth(): Promise<User> {
  const { auth } = requireFirebaseClient();
  if (auth.currentUser?.isAnonymous) return auth.currentUser;
  // This app never presents a login. If an older build left a named account
  // persisted in this browser, detach it and create the single-user session.
  if (auth.currentUser) {
    await signOut(auth);
  }
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? "";
  const messages: Record<string, string> = {
    "auth/operation-not-allowed":
      "Anonymous sign-in is turned off. Open Firebase Console → Authentication → Sign-in method, enable Anonymous, then press Try again.",
    "auth/admin-restricted-operation":
      "Anonymous sign-in is blocked. Open Firebase Console → Authentication → Sign-in method, enable Anonymous, then press Try again.",
    "auth/unauthorized-domain":
      "This domain is not authorized in Firebase Authentication. Add it under Authentication → Settings → Authorized domains.",
    "auth/too-many-requests":
      "Firebase temporarily blocked the session request. Wait a moment and retry.",
    "auth/network-request-failed":
      "Network error while opening the private session. Check your connection and retry.",
    "auth/configuration-not-found": `Firebase Authentication is not set up for ${firebaseProjectId || "this project"}. Open Firebase Console → Authentication → Get started, enable the Anonymous provider, then press Try again.`,
    "auth/invalid-api-key":
      "The Firebase web API key is invalid. Check the public Firebase web configuration for this project.",
  };
  if (messages[code]) return messages[code];
  if (error instanceof Error && error.message) return error.message;
  return "The private session could not be opened. Please try again.";
}
