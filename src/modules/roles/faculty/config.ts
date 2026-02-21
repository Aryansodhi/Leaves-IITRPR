import { FileCheck2, FileSignature, MapPin } from "lucide-react";

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
      label: "Joining report",
      description: "Confirm you are back from sanctioned leave.",
      cta: "Fill the form",
      href: "/joining-report?returnTo=/dashboard/faculty",
      icon: FileCheck2,
    },
    {
      label: "Earned leave form",
      description: "Application for leave or extension (bilingual).",
      cta: "Fill the form",
      href: "/earned-leave?returnTo=/dashboard/faculty",
      icon: FileSignature,
    },
    {
      label: "Station leave form",
      description: "Station leave permission request.",
      cta: "Fill the form",
      href: "/station-leave?returnTo=/dashboard/faculty",
      icon: MapPin,
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
