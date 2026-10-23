"use client";

import * as React from "react";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      toast.success("Back online. Syncing your log.");
    };
    const onOffline = () => {
      setOnline(false);
      toast.info("Offline. Keep logging — changes will sync later.", {
        id: "offline",
      });
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/[0.07] px-3.5 py-2.5 text-[12px] text-warning">
      <WifiOff className="size-4 shrink-0" />
      <span>
        Offline mode — your workout stays on this device and syncs when you
        reconnect.
      </span>
    </div>
  );
}
