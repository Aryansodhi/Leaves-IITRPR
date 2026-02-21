import { FileCheck2, FileSignature, MapPin } from "lucide-react";

import type { RoleDashboardConfig } from "../types";

export const deanDashboard: RoleDashboardConfig = {
  slug: "dean",
  label: "Dean Affairs",
  badge: "Approver",
  blurb:
    "Review HoD-cleared items, handle HoD leave, and clear ex-India plans before Director / Establishment.",
  helper:
    "Dean is the final stop for most teaching leave unless Director approval is flagged.",
  quickActions: [
    {
      label: "Joining report",
      description: "Record post-leave joining updates from departments.",
      cta: "Fill the form",
      href: "/joining-report?returnTo=/dashboard/dean",
      icon: FileCheck2,
    },
    {
      label: "Earned leave form",
      description: "Application for leave or extension (bilingual).",
      cta: "Fill the form",
      href: "/earned-leave?returnTo=/dashboard/dean",
      icon: FileSignature,
    },
    {
      label: "Station leave form",
      description: "Station leave permission request.",
      cta: "Fill the form",
      href: "/station-leave?returnTo=/dashboard/dean",
      icon: MapPin,
    },
  ],
  sections: [
    {
      title: "Director-bound items",
      description: "Make sure dossiers are complete before escalation.",
      items: [
        {
          label: "Sabbatical / long leave",
          detail: "Need Director + Board signoff after you endorse.",
          action: "Prepare brief",
        },
        {
          label: "Air India exemptions",
          detail: "Confirm justification before forwarding to Director.",
          action: "Review request",
        },
        {
          label: "Office order notes",
          detail: "Provide remarks for Establishment to draft orders.",
          action: "Add remarks",
        },
      ],
    },
  ],
};
