import type { RoleDashboardConfig } from "../types";

export const adminDashboard: RoleDashboardConfig = {
  slug: "admin",
  label: "Admin",
  badge: "User provisioning",
  blurb: "Add new institute members and assign their roles.",
  helper: "Use the forms on this page to create users (manual or CSV).",
  quickActions: [],
  sections: [],
};
