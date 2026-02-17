import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<string, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900",
  secondary:
    "bg-white/90 text-slate-900 ring-1 ring-inset ring-slate-200 hover:bg-white focus-visible:outline-slate-400",
  ghost:
    "bg-transparent text-slate-900 hover:bg-slate-100 focus-visible:outline-slate-300",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      type = "button",
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...(!asChild ? { type } : {})}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
