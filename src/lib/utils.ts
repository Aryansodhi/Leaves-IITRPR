import { format, formatDistanceToNow } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDateRange = (start: Date, end: Date) => {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth();

  if (sameYear && sameMonth) {
    return `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
  }

  return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
};

export const relativeTime = (date: Date) =>
  formatDistanceToNow(date, { addSuffix: true });
