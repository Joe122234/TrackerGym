import { cn } from "@/lib/utils";

export function StatusDot({
  status,
  className,
}: {
  status:
    | "completed"
    | "missed"
    | "today"
    | "upcoming"
    | "rest"
    | "pending"
    | "syncing"
    | "error";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-2 shrink-0 rounded-full",
        status === "completed" && "bg-lime",
        status === "missed" && "border border-danger/60 bg-transparent",
        status === "today" && "bg-blue shadow-[0_0_0_3px_rgba(127,168,255,0.12)]",
        status === "upcoming" && "border border-line-strong bg-transparent",
        status === "rest" && "bg-muted-2/60",
        status === "pending" && "bg-warning",
        status === "syncing" && "animate-[timer-pulse_1.4s_ease-in-out_infinite] bg-blue",
        status === "error" && "bg-danger",
        className,
      )}
      aria-hidden
    />
  );
}
