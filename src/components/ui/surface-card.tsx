import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const SurfaceCard = ({
  children,
  className,
  spotlight = false,
}: {
  children: ReactNode;
  className?: string;
  spotlight?: boolean;
}) => (
  <div
    className={cn(
      "rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,.8)] backdrop-blur",
      spotlight &&
        "border-slate-900/10 bg-gradient-to-br from-white via-white to-slate-50",
      className,
    )}
  >
    {children}
  </div>
);
