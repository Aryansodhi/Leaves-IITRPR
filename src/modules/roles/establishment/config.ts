import { Building2, Layers3, MailPlus } from "lucide-react";

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
      label: "Draft office order",
      description: "Use pre-filled templates from workflows.",
      cta: "Create order",
      icon: Building2,
    },
    {
      label: "Limited leave tracker",
      description: "Monitor quotas like special leave, sabbatical slots.",
      cta: "View tracker",
      icon: Layers3,
    },
    {
      label: "Notify Accounts",
      description: "Send sanctioned info for LTC / reimbursements.",
      cta: "Send update",
      icon: MailPlus,
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
