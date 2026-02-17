import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
