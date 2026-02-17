import type { ReactNode } from "react";

export const DashboardShell = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto max-w-5xl space-y-8 py-10">{children}</div>
);
