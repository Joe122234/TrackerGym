"use client";

import * as React from "react";
import { SHARED_LOG_ID } from "@/config/user";
import { isFirebaseConfigured } from "@/lib/firebase/client";

/**
 * The app no longer has a Firebase Auth session. This small context exists so
 * every data hook can keep using a single owner id while the app switches to
 * one public Firestore log shared by all devices.
 */
export interface SessionUser {
  uid: string;
  displayName: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  retry: () => void;
}

const SHARED_USER: SessionUser = {
  uid: SHARED_LOG_ID,
  displayName: null,
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseConfigured();

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user: configured ? SHARED_USER : null,
      loading: false,
      configured,
      error: null,
      retry: () => undefined,
    }),
    [configured],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
