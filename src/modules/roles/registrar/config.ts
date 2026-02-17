import { ArrowDownCircle, BriefcaseBusiness, Stamp } from "lucide-react";

import type { RoleDashboardConfig } from "../types";

export const registrarDashboard: RoleDashboardConfig = {
  slug: "registrar",
  label: "Registrar",
  badge: "Admin lead",
  blurb:
    "Oversee non-teaching approvals, release office memos, and channel select leaves to Director.",
  helper: "Staff leave always lands here after the reporting officer stage.",
  quickActions: [
    {
      label: "Staff approvals",
      description: "Requests cleared by reporting officers.",
      cta: "Approve staff leave",
      icon: BriefcaseBusiness,
    },
    {
      label: "Issue circulars",
      description: "Notify departments about limited leave quotas.",
      cta: "Draft circular",
      icon: Stamp,
    },
    {
      label: "Escalate to Director",
      description: "Forward special cases (long breaks, sabbaticals).",
      cta: "Escalate",
      icon: ArrowDownCircle,
    },
  ],
  sections: [
    {
      title: "Registrar toolkit",
      description: "Keep records tidy and stakeholders informed.",
      items: [
        {
          label: "Service book updates",
          detail: "Record every sanctioned leave.",
          action: "Update records",
        },
        {
          label: "Office orders",
          detail: "Coordinate with Establishment for limited leaves.",
          action: "Coordinate",
        },
        {
          label: "Accounts coordination",
          detail: "Signal LTC approvals to finance team.",
          action: "Notify Accounts",
        },
      ],
    },
  ],
};
