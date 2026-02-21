import { FileCheck2, FileSignature, MapPin } from "lucide-react";

import type { RoleDashboardConfig } from "../types";

export const hodDashboard: RoleDashboardConfig = {
  slug: "hod",
  label: "HoD cockpit",
  badge: "Approver",
  blurb:
    "Approve faculty requests, nominate associate HoD, coordinate coverage and escalate to Dean when needed.",
  helper: "HoD approvals precede Dean/Director for teaching staff.",
  quickActions: [
    {
      label: "Joining report",
      description: "Confirm faculty have resumed duties after leave.",
      cta: "Fill the form",
      href: "/joining-report?returnTo=/dashboard/hod",
      icon: FileCheck2,
    },
    {
      label: "Earned leave form",
      description: "Application for leave or extension (bilingual).",
      cta: "Fill the form",
      href: "/earned-leave?returnTo=/dashboard/hod",
      icon: FileSignature,
    },
    {
      label: "Station leave form",
      description: "Station leave permission request.",
      cta: "Fill the form",
      href: "/station-leave?returnTo=/dashboard/hod",
      icon: MapPin,
    },
  ],
  sections: [
    {
      title: "What needs attention",
      description: "These items unblock Dean and Establishment.",
      items: [
        {
          label: "Earned leave approvals",
          detail: "Prioritise requests nearing travel date.",
          action: "Approve",
          badge: "5 pending",
        },
        {
          label: "Ex-India endorsements",
          detail: "Ensure MoU/academic value justification.",
          action: "Review dossier",
        },
        {
          label: "Office order recommendations",
          detail: "Provide remarks for limited leaves.",
          action: "Add note",
        },
      ],
    },
  ],
};
