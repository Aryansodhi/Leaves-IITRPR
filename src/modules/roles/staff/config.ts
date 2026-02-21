import { FileCheck2, FileSignature, MapPin } from "lucide-react";

import type { RoleDashboardConfig } from "../types";

export const staffDashboard: RoleDashboardConfig = {
  slug: "staff",
  label: "Staff workspace",
  badge: "Applicant",
  blurb:
    "Request casual / earned leave, route through reporting officer, registrar and Accounts when needed.",
  helper:
    "Non-teaching flows always reach Registrar; LTC items also hit Accounts.",

  quickActions: [
    {
      label: "Joining report",
      description: "Upload joining report after returning from leave.",
      cta: "Fill the form",
      href: "/joining-report?returnTo=/dashboard/staff",
      icon: FileCheck2,
    },
    {
      label: "Earned leave form",
      description: "Application for leave or extension (bilingual).",
      cta: "Fill the form",
      href: "/earned-leave?returnTo=/dashboard/staff",
      icon: FileSignature,
    },
    {
      label: "Station leave form",
      description: "Station leave permission request.",
      cta: "Fill the form",
      href: "/station-leave?returnTo=/dashboard/staff",
      icon: MapPin,
    },
  ],

  sections: [
    {
      title: "Reporting chain",
      description: "Requests auto-route to reporting officer → Registrar.",
      items: [
        {
          label: "Notify reporting officer",
          detail: "Ensure supervisor knows your relief plan.",
          action: "Send note",
        },
        {
          label: "Submit joining letter",
          detail: "Mandatory after rejoining duty post leave.",
          action: "Upload letter",
        },
        {
          label: "Check registrar status",
          detail: "See if HR cleared your request.",
          action: "View status",
        },
        {
          label: "Accounts clearance (if LTC)",
          detail: "Attach tickets before Accounts stage.",
          action: "Upload bills",
        },
      ],
    },
  ],
};
