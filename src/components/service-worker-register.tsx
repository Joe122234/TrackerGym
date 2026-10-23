"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error) => console.error("Service worker registration failed", error));
  }, []);
  return null;
}
