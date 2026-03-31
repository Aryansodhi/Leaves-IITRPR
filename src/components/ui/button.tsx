import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[transform,background-color,color,box-shadow,border-color] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100";

const variants: Record<string, string> = {
  primary:
    "bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:shadow-md focus-visible:outline-slate-900",
  secondary:
    "bg-white/90 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-md focus-visible:outline-slate-400",
  ghost:
    "bg-transparent text-slate-900 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-slate-300",
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
