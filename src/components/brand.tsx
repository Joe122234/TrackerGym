import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";

export function BrandMark({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const dimensions =
    size === "sm" ? "size-8 rounded-[10px]" : size === "lg" ? "size-12 rounded-2xl" : "size-10 rounded-xl";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-lime/25 bg-lime/10",
        dimensions,
        className,
      )}
      aria-hidden
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(197,244,103,0.2),transparent_60%)]" />
      <svg
        viewBox="0 0 32 32"
        className={cn(
          "relative",
          size === "sm" ? "size-5" : size === "lg" ? "size-7" : "size-6",
        )}
        fill="none"
      >
        <path
          d="M9 6.5h15v4.2h-10v4.5h8v4.2h-8v7.1H9V6.5Z"
          fill="var(--color-lime)"
        />
        <path
          d="M23 21.2 26 24l-3 2.8V21.2Z"
          fill="var(--color-lime)"
          opacity="0.55"
        />
      </svg>
    </span>
  );
}

export function Wordmark({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="flex flex-col">
        <span className="text-[15px] font-bold tracking-[0.2em] text-ink">
          {BRAND.name}
        </span>
        {showTagline ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-2">
            Performance log
          </span>
        ) : null}
      </span>
    </span>
  );
}
