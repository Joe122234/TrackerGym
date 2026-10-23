import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
  {
    variants: {
      variant: {
        default: "border-line bg-elevated text-muted",
        lime: "border-lime/25 bg-lime/10 text-lime",
        blue: "border-blue/25 bg-blue/10 text-blue",
        violet: "border-violet/25 bg-violet/10 text-violet",
        success: "border-success/25 bg-success/10 text-success",
        warning: "border-warning/25 bg-warning/10 text-warning",
        danger: "border-danger/25 bg-danger/10 text-danger",
        outline: "border-line bg-transparent text-muted",
        solid: "border-transparent bg-ink text-canvas",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span
          className={cn(
            "size-1.5 rounded-full",
            variant === "lime" && "bg-lime",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "danger" && "bg-danger",
            variant === "blue" && "bg-blue",
            (!variant || variant === "default" || variant === "outline") &&
              "bg-muted",
          )}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}

export { badgeVariants };
