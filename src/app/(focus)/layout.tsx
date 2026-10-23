import { AuthBoundary } from "@/components/auth-boundary";
import { RestTimerDock } from "@/components/rest-timer-dock";

export default function FocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthBoundary>
      <div className="min-h-dvh">{children}</div>
      <RestTimerDock className="md:bottom-24" />
    </AuthBoundary>
  );
}
