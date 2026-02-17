import { FilePlus2, Files, ReceiptIndianRupee } from "lucide-react";

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
      label: "Request leave",
      description: "Casual, earned or restricted holiday for staff.",
      cta: "New request",
      icon: FilePlus2,
    },
    {
      label: "LTC claim",
      description: "Start Leave Travel Concession workflow with bills.",
      cta: "Open LTC form",
      icon: ReceiptIndianRupee,
    },
    {
      label: "Upload supporting docs",
      description: "Assign scans for registrar and accounts review.",
      cta: "Upload docs",
      icon: Files,
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
