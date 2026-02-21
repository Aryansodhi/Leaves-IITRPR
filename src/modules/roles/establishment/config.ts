import { FileCheck2, FileSignature, MapPin } from "lucide-react";

import type { RoleDashboardConfig } from "../types";

export const establishmentDashboard: RoleDashboardConfig = {
  slug: "establishment",
  label: "Establishment & Admin",
  badge: "Admin core",
  blurb:
    "Draft office orders, maintain leave ledgers, and keep Director / Registrar informed of critical limits.",
  helper: "Every approved teaching leave lands here for order issue.",
  quickActions: [
    {
      label: "Joining report",
      description: "Collect joining confirmation to close office orders.",
      cta: "Fill the form",
      href: "/joining-report?returnTo=/dashboard/establishment",
      icon: FileCheck2,
    },
    {
      label: "Earned leave form",
      description: "Application for leave or extension (bilingual).",
      cta: "Fill the form",
      href: "/earned-leave?returnTo=/dashboard/establishment",
      icon: FileSignature,
    },
    {
      label: "Station leave form",
      description: "Station leave permission request.",
      cta: "Fill the form",
      href: "/station-leave?returnTo=/dashboard/establishment",
      icon: MapPin,
    },
  ],
  sections: [
    {
      title: "Admin routines",
      description: "Keep paperwork consistent.",
      items: [
        {
          label: "Upload signed order",
          detail: "Attach PDF for applicant & HoD.",
          action: "Upload",
        },
        {
          label: "Update institute records",
          detail: "Central ledger of all sanctioned leave.",
          action: "Update ledger",
        },
        {
          label: "Archive correspondence",
          detail: "Store approvals for audits.",
          action: "Archive",
        },
      ],
    },
  ],
};
