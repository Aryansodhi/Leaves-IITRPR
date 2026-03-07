"use client";

import Image from "next/image";

import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";

export type LeaveApprovalTrailItem = {
  sequence: number;
  actor: string;
  status: string;
  assignedTo: string | null;
  actedAt: string | null;
  remarks: string | null;
};

export type LeaveRequestDetails = {
  referenceCode: string;
  leaveType: string;
  leaveTypeCode?: string | null;
  status: string;
  submittedAt: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  purpose: string;
  destination?: string | null;
  contactDuringLeave?: string | null;
  notes?: string | null;
  currentApprover?: string | null;
  applicant?: {
    name: string;
    role: string;
    department: string;
    designation?: string;
  };
  formData?: Record<string, string> | null;
  approvalTrail?: LeaveApprovalTrailItem[];
  decisionRequired?: boolean;
  viewerOnly?: boolean;
};

const formatFieldLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatFormDate = (value?: string | null) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const buildProfessionalSummary = (request: LeaveRequestDetails) => {
  const applicantName = request.applicant?.name ?? "The applicant";
  const submittedOn = formatDateTime(request.submittedAt);
  const currentApprover = request.currentApprover
    ? ` The request is currently with ${request.currentApprover}.`
    : "";

  if (request.leaveTypeCode === "JR") {
    const rejoinDate =
      request.formData?.rejoinDate ?? request.formData?.englishRejoin;
    const orderNumber =
      request.formData?.orderNo ?? request.formData?.englishOrder;
    const orderDate =
      request.formData?.orderDate ?? request.formData?.englishOrderDate;

    return [
      `${applicantName} submitted a joining report on ${submittedOn}, confirming rejoining duty on ${rejoinDate || formatDate(request.endDate)} after availing leave from ${formatDate(request.startDate)} to ${formatDate(request.endDate)} for ${request.totalDays} day${request.totalDays === 1 ? "" : "s"}.`,
      `${request.viewerOnly ? "This report has been forwarded for information only" : "This report has been routed for approval"}${request.currentApprover ? ` to ${request.currentApprover}` : ""}. Office Order reference: ${orderNumber || "not provided"}${orderDate ? ` dated ${orderDate}` : ""}.`,
    ];
  }

  return [
    `${applicantName} submitted a ${request.leaveType.toLowerCase()} request on ${submittedOn} for the period from ${formatDate(request.startDate)} to ${formatDate(request.endDate)}, covering ${request.totalDays} day${request.totalDays === 1 ? "" : "s"}.`,
    `${request.purpose || "No specific purpose was recorded."}${currentApprover}`,
  ];
};

const humanizeFormEntry = (key: string, value: string) => {
  const label = formatFieldLabel(key);
  const normalized = key.toLowerCase();

  if (["fromdate", "englishfrom"].includes(normalized)) {
    return `The leave period started on ${value}.`;
  }
  if (["todate", "englishto"].includes(normalized)) {
    return `The leave period ended on ${value}.`;
  }
  if (["from"].includes(normalized)) {
    return `The station leave starts on ${value}.`;
  }
  if (["to"].includes(normalized)) {
    return `The station leave ends on ${value}.`;
  }
  if (["days"].includes(normalized)) {
    return `The station leave duration entered in the form is ${value} day${value === "1" ? "" : "s"}.`;
  }
  if (["totaldays", "englishdays"].includes(normalized)) {
    return `The duration recorded in the form is ${value} day${value === "1" ? "" : "s"}.`;
  }
  if (["contactprefix"].includes(normalized)) {
    return `The selected country calling code is ${value}.`;
  }
  if (["contactnumber"].includes(normalized)) {
    return `The contact number provided during leave is ${value}.`;
  }
  if (["contactaddress"].includes(normalized)) {
    return `The address provided during station leave is ${value}.`;
  }
  if (["rejoindate", "englishrejoin"].includes(normalized)) {
    return `The applicant reported rejoining duty on ${value}.`;
  }
  if (["dutysession"].includes(normalized)) {
    return `The applicant reported for duty during the ${value.toLowerCase()}.`;
  }
  if (["leavecategory"].includes(normalized)) {
    return `The leave category selected in the form is ${value}.`;
  }
  if (["orderno", "englishorder"].includes(normalized)) {
    return `The office order reference noted in the form is ${value}.`;
  }
  if (["orderdate", "englishorderdate"].includes(normalized)) {
    return `The office order date recorded in the form is ${value}.`;
  }

  return `${label}: ${value}.`;
};

export const LeaveRequestDetailsModal = ({
  isOpen,
  onClose,
  request,
}: {
  isOpen: boolean;
  onClose: () => void;
  request: LeaveRequestDetails | null;
}) => {
  if (!isOpen || !request) return null;

  const formEntries = Object.entries(request.formData ?? {}).filter(
    ([, value]) => value != null && `${value}`.trim() !== "",
  );
  const professionalSummary = buildProfessionalSummary(request);
  const hasFormPreview =
    request.leaveTypeCode === "SL" || request.leaveTypeCode === "JR";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-8">
      <SurfaceCard className="w-full max-w-4xl space-y-6 border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Leave request details
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">
              {request.referenceCode}
            </h2>
            <p className="text-sm text-slate-600">
              {request.leaveType} | {request.status}
            </p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Submitted
            </p>
            <p className="mt-1 text-sm text-slate-800">
              {formatDateTime(request.submittedAt)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Leave window
            </p>
            <p className="mt-1 text-sm text-slate-800">
              {formatDate(request.startDate)} to {formatDate(request.endDate)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Duration
            </p>
            <p className="mt-1 text-sm text-slate-800">
              {request.totalDays} day{request.totalDays === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {hasFormPreview ? (
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Submitted form
            </p>
            <FormPreview request={request} />
          </section>
        ) : (
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Professional summary
            </p>
            <div className="space-y-3 rounded-2xl border border-slate-200/80 p-4 text-sm leading-7 text-slate-800">
              {professionalSummary.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

        {request.applicant ? (
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Applicant
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailTile label="Name" value={request.applicant.name} />
              <DetailTile label="Role" value={request.applicant.role} />
              <DetailTile
                label="Department"
                value={request.applicant.department}
              />
              <DetailTile
                label="Designation"
                value={request.applicant.designation || "-"}
              />
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Summary
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <DetailTile label="Purpose" value={request.purpose || "-"} />
            <DetailTile
              label="Current approver"
              value={request.currentApprover || "-"}
            />
            <DetailTile
              label="Destination"
              value={request.destination || "-"}
            />
            <DetailTile
              label="Contact during leave"
              value={request.contactDuringLeave || "-"}
            />
            <DetailTile label="Notes" value={request.notes || "-"} />
            <DetailTile
              label="Leave type code"
              value={request.leaveTypeCode || "-"}
            />
          </div>
        </section>

        {!hasFormPreview && formEntries.length > 0 ? (
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Submitted form narrative
            </p>
            <div className="space-y-3 rounded-2xl border border-slate-200/80 p-4 text-sm leading-7 text-slate-800">
              {formEntries.map(([key, value]) => (
                <p key={key}>{humanizeFormEntry(key, value)}</p>
              ))}
            </div>
          </section>
        ) : null}

        {request.approvalTrail && request.approvalTrail.length > 0 ? (
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Approval trail
            </p>
            <div className="space-y-3">
              {request.approvalTrail.map((step) => (
                <div
                  key={`${step.sequence}-${step.actor}`}
                  className="rounded-2xl border border-slate-200/80 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Step {step.sequence}: {formatFieldLabel(step.actor)}
                    </p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {step.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <DetailTile
                      label="Assigned to"
                      value={step.assignedTo || "-"}
                      compact
                    />
                    <DetailTile
                      label="Acted at"
                      value={formatDateTime(step.actedAt)}
                      compact
                    />
                    <DetailTile
                      label="Remarks"
                      value={step.remarks || "-"}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </SurfaceCard>
    </div>
  );
};

const DetailTile = ({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) => (
  <div
    className={`rounded-2xl border border-slate-200/80 ${compact ? "p-3" : "p-4"}`}
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <p className="mt-1 whitespace-pre-wrap break-all text-sm text-slate-800">
      {value}
    </p>
  </div>
);

const FormPreview = ({ request }: { request: LeaveRequestDetails }) => {
  if (request.leaveTypeCode === "SL") {
    return <StationLeavePreview request={request} />;
  }

  if (request.leaveTypeCode === "JR") {
    return <JoiningReportPreview request={request} />;
  }

  return null;
};

const PreviewHeader = () => (
  <div className="space-y-1 text-center text-slate-900">
    <div className="flex items-start justify-center gap-4">
      <Image
        src="/iit_ropar.png"
        alt="IIT Ropar"
        width={72}
        height={72}
        className="object-contain"
      />
      <div className="space-y-1 text-left">
        <p className="text-base font-semibold">
          भारतीय प्रौद्योगिकी संस्थान रोपड़
        </p>
        <p className="text-base font-semibold uppercase">
          INDIAN INSTITUTE OF TECHNOLOGY ROPAR
        </p>
        <p className="text-[11px] text-slate-700">
          नंगल रोड, रूपनगर, पंजाब-140001 / Nangal Road, Rupnagar, Punjab-140001
        </p>
        <p className="text-[11px] text-slate-700">
          दूरभाष / Tele: +91-1881-227078, फैक्स / Fax : +91-1881-223395
        </p>
      </div>
    </div>
  </div>
);

const FilledUnderline = ({
  value,
  width = "w-40",
  align = "text-left",
}: {
  value?: string | null;
  width?: string;
  align?: string;
}) => (
  <span
    className={`inline-flex min-h-6 items-end border-b border-dashed border-slate-500 px-1 text-[13px] text-slate-900 ${width} ${align}`}
  >
    {value && value.trim() ? value : "\u00A0"}
  </span>
);

const StationLeavePreview = ({ request }: { request: LeaveRequestDetails }) => {
  const form = request.formData ?? {};
  const approvalStatusLabel =
    request.status === "APPROVED"
      ? "Approved"
      : request.status === "REJECTED"
        ? "Rejected"
        : "Pending";

  return (
    <SurfaceCard className="mx-auto max-w-3xl space-y-5 border border-slate-300 bg-white p-6 md:p-7">
      <PreviewHeader />
      <div className="border-b border-slate-500" />
      <p className="text-center text-base font-semibold underline text-slate-900">
        STATION LEAVE PERMISSION (SLP)
      </p>

      <div className="space-y-3 text-[13px] text-slate-900">
        <PreviewLine number="1." label="Name" value={form.name} />
        <PreviewLine number="2." label="Designation" value={form.designation} />
        <PreviewLine number="3." label="Department" value={form.department} />

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-6">4.</span>
            <span className="flex-1">
              Dates for which Station Leave Permission is required
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 pl-8">
            <div className="flex items-center gap-2">
              <span>From</span>
              <FilledUnderline value={formatFormDate(form.from)} width="w-32" />
            </div>
            <div className="flex items-center gap-2">
              <span>To</span>
              <FilledUnderline value={formatFormDate(form.to)} width="w-32" />
            </div>
            <div className="flex items-center gap-2">
              <span>No. of days</span>
              <FilledUnderline
                value={form.days}
                width="w-16"
                align="justify-center"
              />
            </div>
          </div>
        </div>

        <PreviewLine
          number="5."
          label="Nature of Leave sanctioned (if applicable)"
          value={form.nature}
        />
        <PreviewLine
          number="6."
          label="Purpose of the Station Leave Permission"
          value={form.purpose}
        />

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-6">7.</span>
            <span className="flex-1">
              Contact number and address during station leave
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-8">
            <FilledUnderline value={form.contactPrefix} width="w-20" />
            <FilledUnderline value={form.contactNumber} width="w-36" />
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-8">
            <span>Address</span>
            <FilledUnderline
              value={form.contactAddress}
              width="w-full max-w-xl"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 text-[13px] text-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <span>Place:</span>
          <FilledUnderline value={form.place} width="w-44" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span>Date:</span>
          <FilledUnderline
            value={formatFormDate(form.date) || form.date}
            width="w-44"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 text-right">
          <span className="text-[12px] text-slate-800">
            (Signature of the applicant)
          </span>
          <FilledUnderline value={form.applicantSign} width="w-64" />
        </div>
      </div>

      <div className="space-y-3 text-center text-[13px] text-slate-900">
        <p className="font-semibold">Approval status</p>
        <p className="text-sm font-semibold text-slate-900">
          {approvalStatusLabel}
        </p>
      </div>
    </SurfaceCard>
  );
};

const JoiningReportPreview = ({
  request,
}: {
  request: LeaveRequestDetails;
}) => {
  const form = request.formData ?? {};

  return (
    <SurfaceCard className="mx-auto max-w-3xl space-y-5 border-slate-200/80 bg-white p-6 md:p-10">
      <div className="flex flex-col items-center gap-3 text-center md:text-left">
        <div className="flex flex-wrap items-center justify-center gap-4 md:flex-nowrap md:justify-start">
          <div className="flex min-h-30 min-w-30 items-center justify-center rounded-full border border-slate-200 bg-white p-2">
            <Image
              src="/iit_ropar.png"
              alt="IIT Ropar"
              width={120}
              height={120}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-1 text-slate-900">
            <p className="text-lg font-semibold">
              भारतीय प्रौद्योगिकी संस्थान रोपड़
            </p>
            <p className="text-lg font-semibold uppercase">
              INDIAN INSTITUTE OF TECHNOLOGY ROPAR
            </p>
            <p className="text-xs text-slate-700">
              नंगल रोड, रूपनगर, पंजाब-140001 / Nangal Road, Rupnagar,
              Punjab-140001
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1 text-sm text-slate-800">
        <p>सेवा में / To,</p>
        <p>निदेशक / कुलसचिव / Director / Registrar</p>
        <p>भा.प्रौ.सं.रोपड़ / IIT Ropar</p>
      </div>

      <p className="text-center text-sm font-semibold text-slate-900">
        विभागाध्यक्ष / रिपोर्टिंग अधिकारी द्वारा / Through HOD/Reporting Officer
      </p>

      <div className="text-center text-sm font-semibold text-slate-900">
        विषय / Sub : कार्यग्रहण प्रतिवेदन / JOINING REPORT
      </div>

      <div className="space-y-4 text-sm leading-relaxed text-slate-900">
        <p>महोदय / Sir,</p>

        <p className="flex flex-wrap items-center gap-2 leading-relaxed">
          <span>मैं,</span>
          <FilledUnderline value={form.name} width="w-56" />
          <span>दिनांक</span>
          <FilledUnderline value={formatFormDate(form.fromDate)} width="w-28" />
          <span>से</span>
          <FilledUnderline value={formatFormDate(form.toDate)} width="w-28" />
          <span>तक</span>
          <FilledUnderline
            value={form.totalDays}
            width="w-16"
            align="justify-center"
          />
          <span>दिन की</span>
          <FilledUnderline value={form.leaveCategory} width="w-64" />
        </p>

        <p className="flex flex-wrap items-center gap-2 leading-relaxed">
          <span>आज दिनांक</span>
          <FilledUnderline
            value={formatFormDate(form.rejoinDate)}
            width="w-28"
          />
          <span>को</span>
          <FilledUnderline value={form.dutySession} width="w-32" />
          <span>
            को अपना कार्यग्रहण प्रतिवेदन जमा कर रहा / रही हूँ, जो की कार्यालय
            आदेश सं.
          </span>
          <FilledUnderline value={form.orderNo} width="w-40" />
          <span>दिनांक</span>
          <FilledUnderline
            value={formatFormDate(form.orderDate)}
            width="w-28"
          />
          <span>के द्वारा स्वीकृत किया था।</span>
        </p>

        <p className="flex flex-wrap items-center gap-2 leading-relaxed">
          <span>I, hereby report myself for duty this day on</span>
          <FilledUnderline value={form.englishRejoin} width="w-36" />
          <span>
            {form.dutySession || "Forenoon / Afternoon"} after availing
          </span>
          <FilledUnderline value={form.leaveCategory} width="w-52" />
          <span>for</span>
          <FilledUnderline
            value={form.englishDays}
            width="w-16"
            align="justify-center"
          />
          <span>days from</span>
          <FilledUnderline value={form.englishFrom} width="w-32" />
          <span>to</span>
          <FilledUnderline value={form.englishTo} width="w-32" />
          <span>sanctioned vide Office Order No.</span>
          <FilledUnderline value={form.englishOrder} width="w-44" />
          <span>dated</span>
          <FilledUnderline value={form.englishOrderDate} width="w-28" />.
        </p>

        <div className="space-y-1 text-right">
          <p>भवदीय / Yours faithfully</p>
          <p>
            हस्ताक्षर / Signature:{" "}
            <FilledUnderline value={form.signature} width="w-56" />
          </p>
          <p>
            नाम / Name : <FilledUnderline value={form.signName} width="w-48" />
          </p>
          <p>
            पदनाम / Designation:{" "}
            <FilledUnderline value={form.signDesignation} width="w-44" />
          </p>
        </div>

        <p className="text-right">
          दिनांक / Dated:{" "}
          <FilledUnderline value={form.signedDate} width="w-32" />
        </p>
      </div>
    </SurfaceCard>
  );
};

const PreviewLine = ({
  number,
  label,
  value,
}: {
  number: string;
  label: string;
  value?: string | null;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="w-6">{number}</span>
    <span className="flex-1">{label}</span>
    <span>:</span>
    <FilledUnderline value={value} width="flex-1 min-w-[12rem]" />
  </div>
);
