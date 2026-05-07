import type { RoleSlug } from "@/modules/roles";

export type LeaveGuide = {
  key: string;
  title: string;
  description: string;
  href: string;
  disabledFor?: RoleSlug[];
  details: string[];
  workflow: string;
};

export const leaveGuides: LeaveGuide[] = [
  {
    key: "joining-report",
    title: "Joining Report",
    description: "Submit your rejoining report after a sanctioned leave ends.",
    href: "/joining-report",
    disabledFor: ["dean", "registrar"],
    details: [
      "Leave period with sessions and auto-calculated total days.",
      "Rejoining date/session with office order number and date.",
      "Leave category selection (earned, half pay, medical, EOL, vacation).",
    ],
    workflow:
      "Routed through HOD/Reporting Officer and recorded by the institute office.",
  },
  {
    key: "earned-leave",
    title: "Earned Leave",
    description: "Apply for earned leave or request an extension.",
    href: "/earned-leave",
    details: [
      "Nature of leave, date range, sessions, and total days.",
      "Purpose and alternative work arrangements/reliever.",
      "LTC choice, address during leave, and station leave requirement.",
    ],
    workflow:
      "Reviewed by HOD/Section In-charge and completed by Administration.",
  },
  {
    key: "ex-india-leave",
    title: "Ex-India Leave",
    description: "Personal travel outside India that needs leave approval.",
    href: "/ex-india-leave",
    details: [
      "Leave type with from/to sessions and total days.",
      "Purpose of visit, alternative arrangements, and documents.",
      "Address during leave and applicant signature.",
    ],
    workflow:
      "Moves via HOD recommendations and Administration/Director approval.",
  },
  {
    key: "non-air-india",
    title: "Non-Air India",
    description: "Permission to travel by an airline other than Air India.",
    href: "/non-air-india",
    details: [
      "Onward/return journey dates with sessions and total travel days.",
      "Place, purpose, sectors, and reason for non-Air India travel.",
      "Budget head and required permissions/approvals.",
    ],
    workflow: "Requires HOD and higher authority approvals before travel.",
  },
  {
    key: "ltc",
    title: "LTC",
    description: "Leave Travel Concession application and claims.",
    href: "/ltc",
    details: [
      "Leave period, journey dates, LTC type, and block year.",
      "Family members, travel mode, and fare estimates.",
      "Declarations and office section verification.",
    ],
    workflow:
      "Reviewed by HOD/Section and processed by Establishment/Accounts.",
  },
  {
    key: "station-leave",
    title: "Station Leave",
    description: "Out-of-station permission request with routing status.",
    href: "/station-leave",
    disabledFor: ["dean", "registrar"],
    details: [
      "Leave dates/sessions with total days computed.",
      "Purpose, out-of-station details, and contact address.",
      "Routing panel and recent history after submission.",
    ],
    workflow: "Follow the routing panel on the page for approval progress.",
  },
];
