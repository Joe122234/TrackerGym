import { AuthBoundary } from "@/components/auth-boundary";
import { AppShell } from "@/components/app-shell";

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthBoundary>
      <AppShell>{children}</AppShell>
    </AuthBoundary>
  );
}
