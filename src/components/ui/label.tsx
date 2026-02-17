import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = ({ className, ...props }: LabelProps) => (
  <label
    className={cn(
      "text-xs font-semibold uppercase tracking-[0.2em] text-slate-500",
      className,
    )}
    {...props}
  />
);
