import { ArrowLeftRight, CheckCircle2, Users } from "lucide-react";

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
      label: "Faculty leave queue",
      description: "All earned / station leave awaiting HoD signature.",
      cta: "Review queue",
      icon: CheckCircle2,
    },
    {
      label: "Delegate to Associate HoD",
      description: "Assign acting approver for your absence.",
      cta: "Set delegate",
      icon: ArrowLeftRight,
    },
    {
      label: "Teaching coverage",
      description: "Plan lecture swaps before granting leave.",
      cta: "Open coverage",
      icon: Users,
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
