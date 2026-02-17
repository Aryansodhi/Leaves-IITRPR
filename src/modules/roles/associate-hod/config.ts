import { BadgeCheck, Layers3, MailPlus } from "lucide-react";

import type { RoleDashboardConfig } from "../types";

export const associateHoDDashboard: RoleDashboardConfig = {
  slug: "associate-hod",
  label: "Associate HoD",
  badge: "Delegated approver",
  blurb:
    "Act when HoD assigns you approvals; keep Dean looped in and update coverage plans.",
  helper: "Only sees queues explicitly delegated by the HoD.",
  quickActions: [
    {
      label: "Delegated approvals",
      description: "Requests you must process while HoD is away.",
      cta: "Open list",
      icon: BadgeCheck,
    },
    {
      label: "Notify Dean on decisions",
      description: "Send summary whenever you approve / decline.",
      cta: "Send update",
      icon: MailPlus,
    },
    {
      label: "Teaching continuity",
      description: "Record class coverage commitments.",
      cta: "Log coverage",
      icon: Layers3,
    },
  ],
  sections: [
    {
      title: "Delegation toolkit",
      description: "Everything you need while acting HoD.",
      items: [
        {
          label: "Faculty leave approvals",
          detail: "Mirror HoD decision notes for transparency.",
          action: "Start reviewing",
        },
        {
          label: "Escalate exceptions",
          detail: "Flag unusual long-duration breaks to Dean.",
          action: "Escalate",
        },
        {
          label: "Return control",
          detail: "Hand approvals back when HoD resumes.",
          action: "End delegation",
        },
      ],
    },
  ],
};
