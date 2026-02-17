import { Globe2, Landmark, ShieldCheck } from "lucide-react";

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
      label: "Executive approvals",
      description: "Long leave, sabbatical, special cases.",
      cta: "Review cases",
      icon: Landmark,
    },
    {
      label: "Ex-India endorsements",
      description: "Trips beyond 30 days or MoE clearance.",
      cta: "View dossiers",
      icon: Globe2,
    },
    {
      label: "Airline exemptions",
      description: "Confirm or decline non-Air India requests.",
      cta: "Sign decision",
      icon: ShieldCheck,
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
