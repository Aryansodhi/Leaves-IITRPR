import { PlaneTakeoff, ReceiptIndianRupee, ShieldPlus } from "lucide-react";

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
      label: "LTC audit queue",
      description: "Claims waiting for scrutiny.",
      cta: "Open audits",
      icon: ReceiptIndianRupee,
    },
    {
      label: "Travel reimbursements",
      description: "Non-LTC reimbursements tied to leave.",
      cta: "View reimbursements",
      icon: PlaneTakeoff,
    },
    {
      label: "Airline exception log",
      description: "Cases seeking non-Air India travel.",
      cta: "Review log",
      icon: ShieldPlus,
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
