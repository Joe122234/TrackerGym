"use client";

import * as React from "react";
import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import {
  authErrorMessage,
  ensureAnonymousAuth,
  subscribeToAuth,
} from "@/lib/firebase/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  retry: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);
  const configured = isFirebaseConfigured();

  React.useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let startingSession = false;

    // There is no sign-in screen. Only the private anonymous identity is
    // accepted. A named account left behind by an earlier build is detached,
    // then the durable single-user session is created.
    const startPrivateSession = () => {
      if (startingSession) return;
      startingSession = true;
      setLoading(true);
      void ensureAnonymousAuth()
        .catch((cause) => {
          if (!active) return;
          setError(authErrorMessage(cause));
          setLoading(false);
        })
        .finally(() => {
          startingSession = false;
        });
    };

    subscribeToAuth((nextUser) => {
      if (!active) return;
      if (nextUser?.isAnonymous) {
        setUser(nextUser);
        setLoading(false);
        setError(null);
        router.prefetch("/");
        return;
      }
      startPrivateSession();
    })
      .then((cleanup) => {
        if (!active) {
          cleanup();
          return;
        }
        unsubscribe = cleanup;
      })
      .catch((cause) => {
        if (!active) return;
        setError(authErrorMessage(cause));
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [configured, retryKey, router]);

  const value = React.useMemo(
    () => ({
      user,
      loading,
      configured,
      error,
      retry: () => setRetryKey((key) => key + 1),
    }),
    [user, loading, configured, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
