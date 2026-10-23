"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { UserDataProvider } from "@/hooks/use-user-data";
import { SessionsProvider } from "@/hooks/use-sessions";
import { ActiveWorkoutProvider } from "@/hooks/use-active-workout";
import { DerivedProvider } from "@/hooks/use-derived";
import { MeasurementsProvider } from "@/hooks/use-measurements";
import { RestTimerProvider } from "@/hooks/use-rest-timer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UserDataProvider>
        <SessionsProvider>
          <ActiveWorkoutProvider>
            <DerivedProvider>
              <MeasurementsProvider>
                <RestTimerProvider>
                  <TooltipProvider delayDuration={250}>
                    {children}
                    <Toaster
                      position="top-center"
                      theme="dark"
                      toastOptions={{
                        style: {
                          background: "#1B2027",
                          border: "1px solid #343D49",
                          color: "#F4F6F8",
                          borderRadius: "14px",
                        },
                      }}
                    />
                    <ServiceWorkerRegister />
                  </TooltipProvider>
                </RestTimerProvider>
              </MeasurementsProvider>
            </DerivedProvider>
          </ActiveWorkoutProvider>
        </SessionsProvider>
      </UserDataProvider>
    </AuthProvider>
  );
}
