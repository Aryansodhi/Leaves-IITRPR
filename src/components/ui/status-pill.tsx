import { cn } from "@/lib/utils";

const palette: Record<string, string> = {
  draft: "text-amber-700 bg-amber-100",
  submitted: "text-sky-800 bg-sky-100",
  review: "text-indigo-800 bg-indigo-100",
  approved: "text-emerald-800 bg-emerald-100",
  rejected: "text-rose-800 bg-rose-100",
};

export type StatusPillProps = {
  label: string;
  tone?: keyof typeof palette;
};

export const StatusPill = ({ label, tone = "submitted" }: StatusPillProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
      palette[tone] ?? palette.submitted,
    )}
  >
    {label}
  </span>
);
