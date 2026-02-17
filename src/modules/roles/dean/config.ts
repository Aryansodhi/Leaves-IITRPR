import { CheckCircle2, Globe2, Users } from "lucide-react";

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
      label: "Dean approval queue",
      description: "Requests already vetted by HoDs.",
      cta: "Open queue",
      icon: CheckCircle2,
    },
    {
      label: "HoD leave nominations",
      description: "Assign temporary HoDs when needed.",
      cta: "Assign acting HoD",
      icon: Users,
    },
    {
      label: "Ex-India pipeline",
      description: "Monitor travel requiring Director or MoE approval.",
      cta: "View pipeline",
      icon: Globe2,
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
