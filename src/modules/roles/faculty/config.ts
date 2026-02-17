import { CalendarDays, CheckCircle2, FileCheck2 } from "lucide-react";

import type { RoleDashboardConfig } from "../types";

export const facultyDashboard: RoleDashboardConfig = {
  slug: "faculty",
  label: "Faculty workspace",
  badge: "Applicant",
  blurb:
    "Plan teaching relief, apply for leave, upload reports, and see what’s pending with HoD or Dean.",
  helper:
    "Every request starts here. We route it to HoD ➝ Dean ➝ Establishment automatically.",
  quickActions: [
    {
      label: "Apply Earned / Station Leave",
      description: "Start EL, station leave or combine with travel plans.",
      cta: "Start application",
      icon: CalendarDays,
    },
    {
      label: "Submit Joining Report",
      description: "Confirm you are back from sanctioned leave.",
      cta: "Submit report",
      icon: FileCheck2,
    },
    {
      label: "Track My Requests",
      description: "See what’s with HoD, Dean or Establishment.",
      cta: "Open tracker",
      icon: CheckCircle2,
    },
  ],
  sections: [
    {
      title: "Plan & apply",
      description: "Pick the leave type that matches your travel.",
      items: [
        {
          label: "Earned Leave",
          detail: "HoD ➝ Dean ➝ Establishment path.",
          action: "Apply EL",
        },
        {
          label: "Ex-India visit",
          detail: "Attach invitation, Dean + Director approvals required.",
          action: "Start ex-India",
        },
        {
          label: "Air India exemption",
          detail: "Use when institute approval for other airlines is needed.",
          action: "Request permission",
        },
      ],
    },
    {
      title: "After leave",
      description: "Finish mandatory steps after returning.",
      items: [
        {
          label: "Upload travel bills",
          detail: "Send to Accounts for LTC / reimbursements.",
          action: "Upload now",
        },
        {
          label: "Submit office order copy",
          detail: "Attach signed order from Establishment if applicable.",
          action: "Share order",
        },
        {
          label: "Share teaching handover notes",
          detail: "Keep HoD informed of coverage plans.",
          action: "Add notes",
        },
      ],
    },
  ],
};
