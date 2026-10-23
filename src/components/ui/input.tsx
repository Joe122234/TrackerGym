import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-xl border border-line bg-canvas-soft px-3.5 text-[15px] text-ink shadow-inner shadow-black/10 outline-none transition-colors placeholder:text-muted-2 focus:border-lime/60 focus:ring-2 focus:ring-lime/10 aria-[invalid=true]:border-danger/60 aria-[invalid=true]:ring-danger/10 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full resize-y rounded-xl border border-line bg-canvas-soft px-3.5 py-3 text-[15px] text-ink shadow-inner shadow-black/10 outline-none transition-colors placeholder:text-muted-2 focus:border-lime/60 focus:ring-2 focus:ring-lime/10 aria-[invalid=true]:border-danger/60 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Input, Textarea };
