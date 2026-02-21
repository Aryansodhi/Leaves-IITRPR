import { FileCheck2, FileSignature, MapPin } from "lucide-react";

import type { RoleDashboardConfig } from "../types";

export const accountsDashboard: RoleDashboardConfig = {
  slug: "accounts",
  label: "Accounts & Finance",
  badge: "Reviewer",
  blurb:
    "Handle LTC audits, airfare exceptions, reimbursements, and relay status to Registrar.",
  helper:
    "Only specific leave categories need you—mostly LTC and airline permissions.",
  quickActions: [
    {
      label: "Joining report",
      description: "Record that the employee rejoined post leave.",
      cta: "Fill the form",
      href: "/joining-report?returnTo=/dashboard/accounts",
      icon: FileCheck2,
    },
    {
      label: "Earned leave form",
      description: "Application for leave or extension (bilingual).",
      cta: "Fill the form",
      href: "/earned-leave?returnTo=/dashboard/accounts",
      icon: FileSignature,
    },
    {
      label: "Station leave form",
      description: "Station leave permission request.",
      cta: "Fill the form",
      href: "/station-leave?returnTo=/dashboard/accounts",
      icon: MapPin,
    },
  ],
  sections: [
    {
      title: "Finance checks",
      description: "Help Establishment close the loop.",
      items: [
        {
          label: "Verify documents",
          detail: "Tickets, invoices, approvals from Registrar.",
          action: "Start verifying",
        },
        {
          label: "Raise clarifications",
          detail: "Ping applicants for any missing bills.",
          action: "Send query",
        },
        {
          label: "Mark as cleared",
          detail: "Signal Registrar/Establishment once finance approves.",
          action: "Mark cleared",
        },
      ],
    },
  ],
};
