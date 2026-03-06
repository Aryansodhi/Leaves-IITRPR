"use client";

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

        {formEntries.length > 0 ? (
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Submitted form fields
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {formEntries.map(([key, value]) => (
                <DetailTile
                  key={key}
                  label={formatFieldLabel(key)}
                  value={value}
                />
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
