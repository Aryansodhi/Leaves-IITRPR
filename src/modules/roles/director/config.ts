import { FileCheck2, FileSignature, MapPin } from "lucide-react";

import type { RoleDashboardConfig } from "../types";

export const directorDashboard: RoleDashboardConfig = {
  slug: "director",
  label: "Director",
  badge: "Final authority",
  blurb:
    "See escalations needing institute-level approval (long breaks, ex-India visits, airline exemptions).",
  helper: "Only requests flagged by Dean/Registrar appear here.",
  quickActions: [
    {
      label: "Joining report",
      description: "Review critical rejoining confirmations escalated to you.",
      cta: "Fill the form",
      href: "/joining-report?returnTo=/dashboard/director",
      // Open in same window; target removed.
      icon: FileCheck2,
    },
    {
      label: "Earned leave form",
      description: "Application for leave or extension (bilingual).",
      cta: "Fill the form",
      href: "/earned-leave?returnTo=/dashboard/director",
      icon: FileSignature,
    },
    {
      label: "Station leave form",
      description: "Station leave permission request.",
      cta: "Fill the form",
      href: "/station-leave?returnTo=/dashboard/director",
      icon: MapPin,
    },
  ],
  sections: [
    {
      title: "What needs your decision",
      description: "Prepared by Dean/Registrar.",
      items: [
        {
          label: "Sabbatical approvals",
          detail: "Ensure coverage + funding plan is supplied.",
          action: "Approve / decline",
        },
        {
          label: "Director’s notes",
          detail: "Add remarks for Establishment orders.",
          action: "Add note",
        },
        {
          label: "Communicate decisions",
          detail: "Send signed memo back to Dean & Registrar.",
          action: "Send memo",
        },
      ],
    },
  ],
};
