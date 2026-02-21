import type { ComponentType } from "react";

export type RoleSlug =
  | "faculty"
  | "staff"
  | "hod"
  | "associate-hod"
  | "dean"
  | "registrar"
  | "accounts"
  | "establishment"
  | "director"
  | "admin";

export type QuickAction = {
  label: string;
  description: string;
  cta: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  target?: "_self" | "_blank" | "_parent" | "_top";
};

export type SectionItem = {
  label: string;
  detail: string;
  action: string;
  badge?: string;
};

export type DashboardSection = {
  title: string;
  description: string;
  items: SectionItem[];
};

export type RoleDashboardConfig = {
  slug: RoleSlug;
  label: string;
  badge: string;
  blurb: string;
  helper: string;
  quickActions: QuickAction[];
  sections: DashboardSection[];
  reminders?: string[];
};
