import { FileCheck2, FileSignature, MapPin } from "lucide-react";

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
      label: "Joining report",
      description: "Capture joining confirmations for staff cases.",
      cta: "Fill the form",
      href: "/joining-report?returnTo=/dashboard/registrar",
      icon: FileCheck2,
    },
    {
      label: "Earned leave form",
      description: "Application for leave or extension (bilingual).",
      cta: "Fill the form",
      href: "/earned-leave?returnTo=/dashboard/registrar",
      icon: FileSignature,
    },
    {
      label: "Station leave form",
      description: "Station leave permission request.",
      cta: "Fill the form",
      href: "/station-leave?returnTo=/dashboard/registrar",
      icon: MapPin,
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
