import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[background-color,color,border-color,transform,opacity] duration-150 disabled:pointer-events-none disabled:opacity-45 active:translate-y-[0.5px] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-lime text-canvas shadow-[0_1px_0_rgba(255,255,255,0.22)_inset] hover:bg-lime-strong",
        secondary:
          "bg-elevated text-ink border border-line hover:border-line-strong hover:bg-elevated-2",
        outline:
          "border border-line bg-transparent text-ink hover:bg-elevated hover:border-line-strong",
        ghost:
          "bg-transparent text-muted hover:bg-elevated hover:text-ink",
        limeSoft:
          "bg-lime/10 text-lime border border-lime/20 hover:bg-lime/15",
        danger:
          "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/15",
        link: "text-lime underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px] [&_svg]:size-4",
        default: "h-11 px-4 [&_svg]:size-4",
        lg: "h-[52px] px-5 text-[15px] [&_svg]:size-5",
        icon: "size-11 p-0 [&_svg]:size-5",
        iconSm: "size-9 p-0 [&_svg]:size-4",
        pill: "h-9 rounded-full px-3.5 text-xs [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            <span>Working…</span>
            {children ? <span className="sr-only">{children}</span> : null}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
