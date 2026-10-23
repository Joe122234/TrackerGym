"use client";

import * as React from "react";

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("FORGE render error", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh items-center justify-center px-5">
          <div className="w-full max-w-md rounded-panel border border-line bg-surface p-6 text-center">
            <p className="athletic-label mb-2">Something broke</p>
            <h1 className="text-2xl font-semibold tracking-[-0.03em]">
              The app hit an unexpected error.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Your saved history is safe in Firestore. Reload to try again.
            </p>
            <button
              type="button"
              className="mt-5 h-11 w-full rounded-xl bg-lime px-4 text-sm font-semibold text-canvas"
              onClick={() => window.location.reload()}
            >
              Reload FORGE
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
