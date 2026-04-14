"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { downloadFormAsPdf } from "@/lib/pdf-export";

export type LeaveApprovalTrailItem = {
  sequence: number;
  actor: string;
  status: string;
  assignedTo: string | null;
  actedBy?: string | null;
  actedAt: string | null;
  remarks: string | null;
  recommended?: string | null;
  hodSignature?: string | null;
  accountsSignature?: string | null;
  balance?: string | null;
  decisionDate?: string | null;
  ipAddress?: string | null;
  approverSignatureProof?: {
    image?: string | null;
    animation?: unknown[] | null;
  } | null;
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
  applicantIp?: string | null;
  applicant?: {
    name: string;
    role: string;
    department: string;
    designation?: string;
  };
  formData?: Record<string, string> | null;
  signatureProof?: {
    formId?: string;
    animation?: Array<{
      points: Array<{ x: number; y: number; time: number }>;
      color?: string;
    }>;
    image?: string;
    timestamp?: string;
    hash?: string;
    otpVerified?: boolean;
  } | null;
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

const isEarnedLeaveType = (request: LeaveRequestDetails) =>
  (request.leaveTypeCode ?? "").toUpperCase() === "EL" ||
  request.leaveType.toLowerCase().includes("earned");

const isLtcType = (request: LeaveRequestDetails) =>
  (request.leaveTypeCode ?? "").toUpperCase() === "LTC" ||
  request.leaveType.toLowerCase().includes("ltc") ||
  request.leaveType.toLowerCase().includes("leave travel");

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

export const LeaveRequestDetailsModal = ({
  isOpen,
  onClose,
  request,
  onWithdraw,
  canWithdraw = false,
  withdrawBusy = false,
  footer,
  displayMode = "default",
}: {
  isOpen: boolean;
  onClose: () => void;
  request: LeaveRequestDetails | null;
  onWithdraw?: () => void;
  canWithdraw?: boolean;
  withdrawBusy?: boolean;
  footer?: ReactNode;
  displayMode?: "default" | "form-only";
}) => {
  const printableRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !request) return null;

  const handleDownloadPdf = async () => {
    if (!printableRef.current) return;

    setIsDownloading(true);
    try {
      await downloadFormAsPdf(
        printableRef.current,
        `${request.referenceCode}-details`,
        { sanitizeFormFields: false },
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const professionalSummary = buildProfessionalSummary(request);
  const hasFormData = Boolean(
    request.formData && Object.keys(request.formData).length > 0,
  );
  const hasFormPreview =
    // show full form for station leave (SL), joining report (JR), or when request has
    // form data and has already been approved. Approved records are often reviewed
    // later by applicants or controllers so the original data should be visible.
    Boolean(request.formData && Object.keys(request.formData).length > 0) &&
    (isEarnedLeaveType(request) ||
      request.leaveTypeCode === "SL" ||
      request.leaveTypeCode === "JR" ||
      isLtcType(request));

  const showSubmittedForm =
    displayMode === "form-only" ? hasFormData : hasFormPreview;

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
          <div className="flex items-center gap-2">
            {canWithdraw && onWithdraw ? (
              <Button
                variant="secondary"
                onClick={onWithdraw}
                disabled={withdrawBusy}
              >
                {withdrawBusy ? "Withdrawing..." : "Withdraw"}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
            >
              {isDownloading ? "Preparing..." : "Download PDF"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div ref={printableRef} className="space-y-6">
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

          {showSubmittedForm ? (
            <section className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Submitted form
              </p>
              <FormPreview request={request} />
            </section>
          ) : displayMode === "form-only" ? (
            <section className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Submitted form
              </p>
              <div className="rounded-2xl border border-slate-200/80 p-4 text-sm text-slate-700">
                No submitted form data is available for this application.
              </div>
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

          {displayMode === "form-only" ? null : (
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
                {request.applicantIp ? (
                  <DetailTile
                    label="Applicant IP"
                    value={request.applicantIp}
                  />
                ) : null}
                <DetailTile label="Notes" value={request.notes || "-"} />
                <DetailTile
                  label="Leave type code"
                  value={request.leaveTypeCode || "-"}
                />
              </div>
            </section>
          )}

          {request.signatureProof ? (
            <section className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Digital signature verification
              </p>
              <SignatureReplayCard proof={request.signatureProof} />
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
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <DetailTile
                        label="Assigned to"
                        value={step.assignedTo || "-"}
                        compact
                      />
                      <DetailTile
                        label="Action by"
                        value={step.actedBy || "-"}
                        compact
                      />
                      <DetailTile
                        label="Acted at"
                        value={formatDateTime(step.actedAt)}
                        compact
                      />
                      <DetailTile
                        label="IP address"
                        value={step.ipAddress || "-"}
                        compact
                      />
                      <DetailTile
                        label="Remarks"
                        value={step.remarks || "-"}
                        compact
                      />
                    </div>
                    {(step.recommended ||
                      step.hodSignature ||
                      step.accountsSignature ||
                      step.balance ||
                      step.decisionDate ||
                      step.approverSignatureProof?.image) && (
                      <div className="mt-2 space-y-2">
                        {step.recommended && (
                          <p className="text-sm">
                            <strong>Recommendation:</strong> {step.recommended}
                          </p>
                        )}
                        {step.balance && (
                          <p className="text-sm">
                            <strong>Balance as on date:</strong> {step.balance}
                          </p>
                        )}
                        {step.hodSignature && (
                          <p className="text-sm">
                            <strong>Signature:</strong> {step.hodSignature}
                          </p>
                        )}
                        {step.approverSignatureProof?.image ? (
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">
                              Digital signature
                            </p>
                            <Image
                              src={step.approverSignatureProof.image}
                              alt="Approver signature"
                              width={560}
                              height={180}
                              unoptimized
                              className="h-24 w-full rounded-xl border border-slate-200 bg-white object-contain"
                            />
                          </div>
                        ) : null}
                        {step.accountsSignature && !step.hodSignature && (
                          <p className="text-sm">
                            <strong>Certified by:</strong>{" "}
                            {step.accountsSignature}
                          </p>
                        )}
                        {step.decisionDate && (
                          <p className="text-sm">
                            <strong>Decision date:</strong> {step.decisionDate}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {footer ? (
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Your action
            </p>
            {footer}
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

const SignatureReplayCard = ({
  proof,
}: {
  proof: NonNullable<LeaveRequestDetails["signatureProof"]>;
}) => {
  const [showReplay, setShowReplay] = useState(false);
  const hasAnimation = Boolean(proof.animation && proof.animation.length > 0);

  return (
    <div className="relative space-y-3 rounded-2xl border border-slate-200/80 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <DetailTile
          label="OTP verified"
          value={proof.otpVerified ? "Yes" : "No"}
          compact
        />
        <DetailTile
          label="Signed at"
          value={formatDateTime(proof.timestamp ?? null)}
          compact
        />
      </div>
      <DetailTile label="SHA256 hash" value={proof.hash ?? "-"} compact />

      {proof.image ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Applicant signature (read-only)
          </p>
          <Image
            src={proof.image}
            alt="Stored signature"
            width={520}
            height={170}
            className="h-40 w-full max-w-2xl rounded-md border border-slate-200 bg-white object-contain"
            unoptimized
          />
        </div>
      ) : null}

      {hasAnimation ? (
        <div className="flex justify-start">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowReplay(true)}
            className="text-xs"
          >
            View stroke preview
          </Button>
        </div>
      ) : null}

      {showReplay && hasAnimation ? (
        <div className="absolute inset-0 z-60 flex items-center justify-center rounded-2xl bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Signature stroke preview
              </p>
              <Button
                type="button"
                variant="ghost"
                className="px-2 text-xs"
                onClick={() => setShowReplay(false)}
              >
                Close
              </Button>
            </div>
            <SignatureReplayCanvas animation={proof.animation ?? []} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

const SignatureReplayCanvas = ({
  animation,
}: {
  animation: NonNullable<LeaveRequestDetails["signatureProof"]>["animation"];
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animation || animation.length === 0) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(Math.floor(bounds.width), 280);
    const height = 220;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.scale(ratio, ratio);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";

    const segments: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      t: number;
      color: string;
    }> = [];
    const points: Array<{ x: number; y: number }> = [];

    animation.forEach((stroke) => {
      stroke.points.forEach((point) => {
        points.push({ x: point.x, y: point.y });
      });
      for (let index = 1; index < stroke.points.length; index += 1) {
        const prev = stroke.points[index - 1];
        const next = stroke.points[index];
        segments.push({
          x1: prev.x,
          y1: prev.y,
          x2: next.x,
          y2: next.y,
          t: next.time,
          color: stroke.color ?? "rgb(15, 23, 42)",
        });
      }
    });

    if (segments.length === 0 || points.length === 0) return;

    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const sourceWidth = Math.max(maxX - minX, 1);
    const sourceHeight = Math.max(maxY - minY, 1);
    const padding = 16;
    const scale = Math.min(
      (width - padding * 2) / sourceWidth,
      (height - padding * 2) / sourceHeight,
    );
    const offsetX = (width - sourceWidth * scale) / 2;
    const offsetY = (height - sourceHeight * scale) / 2;
    const mapX = (value: number) => (value - minX) * scale + offsetX;
    const mapY = (value: number) => (value - minY) * scale + offsetY;

    const firstTime = segments[0]?.t ?? 0;
    const lastTime = segments[segments.length - 1]?.t ?? firstTime;
    const totalDuration = Math.max(lastTime - firstTime, 500);

    let index = 0;
    let frameId = 0;
    const startedAt = performance.now();

    const draw = (now: number) => {
      const elapsed = (now - startedAt) * 1.8;
      const currentTime = firstTime + Math.min(elapsed, totalDuration);

      while (index < segments.length && segments[index].t <= currentTime) {
        const segment = segments[index];
        context.strokeStyle = segment.color;
        context.beginPath();
        context.moveTo(mapX(segment.x1), mapY(segment.y1));
        context.lineTo(mapX(segment.x2), mapY(segment.y2));
        context.stroke();
        index += 1;
      }

      if (index < segments.length) {
        frameId = window.requestAnimationFrame(draw);
      }
    };

    frameId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [animation]);

  return (
    <canvas
      ref={canvasRef}
      className="h-56 w-full rounded-md border border-dashed border-slate-300 bg-white"
    />
  );
};

const FormPreview = ({ request }: { request: LeaveRequestDetails }) => {
  if (request.leaveTypeCode === "SL") {
    return <StationLeavePreview request={request} />;
  }

  if (request.leaveTypeCode === "JR") {
    return <JoiningReportPreview request={request} />;
  }

  if (isLtcType(request)) {
    return <LtcPreview request={request} />;
  }

  if (isEarnedLeaveType(request)) {
    return <EarnedLeavePreview request={request} />;
  }

  if ((request.leaveTypeCode ?? "").toUpperCase() === "EXIN") {
    return <ExIndiaLeavePreview request={request} />;
  }

  if ((request.leaveTypeCode ?? "").toUpperCase() === "AIR") {
    return <NonAirIndiaPreview request={request} />;
  }

  return null;
};

const ExIndiaLeavePreview = ({ request }: { request: LeaveRequestDetails }) => {
  const form = request.formData ?? {};

  const fromDate = formatFormDate(form.fromDate) || form.fromDate;
  const toDate = formatFormDate(form.toDate) || form.toDate;

  return (
    <div className="space-y-4">
      <SurfaceCard className="mx-auto max-w-4xl space-y-4 border border-slate-300 bg-white p-3 sm:p-4 md:p-6">
        <header className="space-y-1 text-center text-slate-900">
          <p className="text-sm font-semibold sm:text-base">
            भारतीय प्रौद्योगिकी संस्थान रोपड़
          </p>
          <p className="text-sm font-semibold uppercase sm:text-base">
            INDIAN INSTITUTE OF TECHNOLOGY ROPAR
          </p>
          <p className="text-[11px] text-slate-700">
            रूपनगर, पंजाब-140001 / Rupnagar, Punjab-140001
          </p>
          <p className="text-[12px] font-semibold">
            व्यक्तिगत आधार पर भारत के बाहर यात्रा के लिए छुट्टी या छुट्टी के
            विस्तार के लिए आवेदन /
          </p>
          <p className="text-[12px] font-semibold">
            Application for Leave or Extension of Leave for Ex-India visit on
            personal ground
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full border border-slate-400 text-[11px] text-slate-900 sm:text-[12px]">
            <colgroup>
              <col className="w-[36%]" />
              <col />
            </colgroup>
            <tbody>
              <PreviewRow
                label="1. आवेदक का नाम / Name of the applicant"
                value={form.name}
              />
              <PreviewRow label="2. पद नाम / Post held" value={form.post} />
              <PreviewRow
                label="3. विभाग/केन्द्रीय कार्यालय/अनुभाग/Department./Office/Section"
                value={form.department}
              />
              <PreviewRow
                label="4. अवकाश का प्रकार / Nature of Leave applied for"
                value={form.leaveType}
              />
              <tr className="border-t border-slate-400">
                <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
                  5. छुट्टी की अवधि / Period of Leave
                </td>
                <td className="px-3 py-2 text-[12px]">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                      <span>से / From:</span>
                      <FilledUnderline value={fromDate} width="w-full" />
                      <FilledUnderline
                        value={form.fromSession}
                        width="w-32"
                        align="text-center"
                      />
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                      <span>तक / To:</span>
                      <FilledUnderline value={toDate} width="w-full" />
                      <FilledUnderline
                        value={form.toSession}
                        width="w-32"
                        align="text-center"
                      />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2">
                      <span>दिनों की संख्या / No. of days:</span>
                      <FilledUnderline
                        value={form.days}
                        width="w-full"
                        align="text-center"
                      />
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
                  6. रविवार, अवकाश और अवकाश, छुट्टी से पहले या पश्चात मिलाना
                  चाहते हैं
                  <div className="text-[11px] font-normal">
                    Sunday and Holiday, if any, proposed to be prefixed/suffixed
                    to leave
                  </div>
                </td>
                <td className="space-y-2 px-3 py-2 text-[12px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>के पूर्व Prefix</span>
                    <FilledUnderline value={form.prefixFrom} width="w-28" />
                    <span>से / From:</span>
                    <FilledUnderline
                      value={
                        formatFormDate(form.prefixFromDate) ||
                        form.prefixFromDate
                      }
                      width="w-28"
                    />
                    <span>तक / To:</span>
                    <FilledUnderline
                      value={
                        formatFormDate(form.prefixToDate) || form.prefixToDate
                      }
                      width="w-28"
                    />
                    <span>दिनों की संख्या / No. of days:</span>
                    <FilledUnderline value={form.prefixDays} width="w-20" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>के पश्चात Suffix</span>
                    <FilledUnderline value={form.suffixFrom} width="w-28" />
                    <span>से / From:</span>
                    <FilledUnderline
                      value={
                        formatFormDate(form.suffixFromDate) ||
                        form.suffixFromDate
                      }
                      width="w-28"
                    />
                    <span>तक / To:</span>
                    <FilledUnderline
                      value={
                        formatFormDate(form.suffixToDate) || form.suffixToDate
                      }
                      width="w-28"
                    />
                    <span>दिनों की संख्या / No. of days:</span>
                    <FilledUnderline value={form.suffixDays} width="w-20" />
                  </div>
                </td>
              </tr>
              <PreviewRow
                label="7. उद्देश्य / Purpose of the visit"
                value={form.purpose}
              />
              <PreviewRow
                label="8. कार्य, प्रशासनिक जिम्मेदारियों आदि (यदि कोई हो) के लिए वैकल्पिक व्यवस्था / Alternative arrangements"
                value={form.arrangements}
              />
              <tr className="border-t border-slate-400">
                <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
                  9. मैं उपयुक्त दस्तावेज संलग्न कर रहा/रही हूँ / I am attaching
                  the following necessary documents alongwith the form:
                </td>
                <td className="space-y-2 px-3 py-2 text-[12px]">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>(i) Application addressed to the Director :</span>
                    <span>Yes / No</span>
                    <FilledUnderline value={form.docDirector} width="w-20" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span>(ii) Undertaking / agreement (Form I & Form 2)</span>
                    <span>:</span>
                    <span>Yes / No</span>
                    <FilledUnderline value={form.docAgreement} width="w-20" />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
                  10. अवकाश के दौरान पता / Address during the leave
                </td>
                <td className="space-y-2 px-3 py-2 text-[12px]">
                  <FilledUnderline value={form.address} width="w-full" />
                  <div className="flex flex-wrap items-center gap-3">
                    <span>संपर्क नं. / Contact No.</span>
                    <FilledUnderline value={form.contactNo} width="w-40" />
                    <span>पिन / PIN:</span>
                    <FilledUnderline value={form.pin} width="w-24" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-right text-[12px] text-slate-900">
          आवेदक के हस्ताक्षर दिनांक सहित / Signature of the applicant with date:{" "}
          <FilledUnderline value={form.applicantSignature} width="w-60" />
        </p>

        <div className="space-y-2 border-t border-slate-400 pt-2 text-[11px] text-slate-900 sm:text-[12px]">
          <p className="text-center font-semibold">
            नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें / Remarks and
            Recommendations of the controlling officer
          </p>
          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p className="leading-snug">
              सिफारिश की गई / Recommended या नहीं की गई / not recommended:
            </p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.recommended} width="w-full" />
            </div>
          </div>
          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p className="leading-snug">
              विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित / Signature
              with date Head of Department/Section In-charge:
            </p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.hodSignature} width="w-full" />
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-400 pt-2 text-[11px] text-slate-900 sm:text-[12px]">
          <p className="text-center font-semibold">
            प्रशासनिक अनुभाग द्वारा प्रयोग हेतु / For use by the Administration
            Section
          </p>
          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <div className="space-y-1 leading-snug">
              <p>
                प्रमाणित किया जाता है कि (प्रकृति) / Certified that (nature of
                leave) for period:
              </p>
              <p>is available as per following details:</p>
            </div>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <span>from</span>
                <FilledUnderline value={form.adminFrom} width="w-full" />
                <span>to</span>
                <FilledUnderline value={form.adminTo} width="w-full" />
              </div>
            </div>
          </div>

          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p className="leading-snug">
              अवकाश का प्रकार / Nature of leave applied for
            </p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.adminLeaveType} width="w-full" />
            </div>
          </div>

          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p className="leading-snug">
              आज की तिथि तक शेष / Balance as on date
            </p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.balance} width="w-full" />
            </div>
          </div>

          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p className="leading-snug">
              कुल दिनों के लिए अवकाश / Leave applied for (No. of days)
            </p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.adminDays} width="w-full" />
            </div>
          </div>

          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p className="leading-snug">संबंधित सहायक / Dealing Assistant</p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.assistant} width="w-full" />
            </div>
          </div>

          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p className="leading-snug">Jr. Supdt.</p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.jrSupdt} width="w-full" />
            </div>
          </div>

          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p className="leading-snug">
              अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/ सुपdt./AR/DR
            </p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.arDr} width="w-full" />
            </div>
          </div>

          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p className="leading-snug">
              कुलसचिव/ अधिकारी (Faculty Affairs & Administration) के हस्ताक्षर /
              Signature of Registrar / Dean (Faculty Affairs & Administration)
            </p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.registrarSign} width="w-full" />
            </div>
          </div>

          <div className="space-y-1 leading-snug">
            <p>
              छुट्टी प्रदान करने के लिए सक्षम प्राधिकारी की टिप्पणी : स्वीकृत /
              अस्वीकृत / Comments of the competent authority to grant leave:
              Sanctioned / Not Sanctioned
            </p>
          </div>

          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
            <p>निदेशक / Director:</p>
            <div className="w-full lg:w-88 lg:justify-self-end">
              <FilledUnderline value={form.directorSign} width="w-full" />
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="mx-auto max-w-4xl space-y-4 border border-slate-300 bg-white p-3 sm:p-4 md:p-6">
        <div className="text-[12px] text-slate-900 sm:text-[13px]">
          <p>The Director</p>
          <p>Indian Institute of Technology</p>
          <p>Ropar</p>

          <p className="mt-4 font-semibold">
            Subject: Application for Leave Ex-India for Private Visit.
          </p>

          <p className="mt-4">Sir,</p>

          <p className="mt-4">
            I wish to proceed abroad to{" "}
            <FilledUnderline value={form.country} width="w-64" /> (Country) for
            the following purpose:-
          </p>

          <p className="mt-3">
            I request that I may kindly be granted leave of the due / leave
            without pay Ex-India for{" "}
            <FilledUnderline value={form.exDays} width="w-20" /> days from{" "}
            <FilledUnderline value={form.exFrom} width="w-32" /> to{" "}
            <FilledUnderline value={form.exTo} width="w-32" />. I am holding a
            valid passport for visit to the aforesaid country / countries.
          </p>

          <p className="mt-3">
            During my stay in the above country / countries, my address will be
            as under:-
          </p>
          <div className="space-y-2 pt-2">
            <FilledUnderline value={form.addr1} width="w-full" />
            <FilledUnderline value={form.addr2} width="w-full" />
            <FilledUnderline value={form.addr3} width="w-full" />
          </div>

          <p className="mt-4">I hereby undertake that:-</p>
          <ol className="ml-6 mt-2 list-decimal space-y-1">
            <li>
              I shall return to duty on expiry of the aforesaid leave and shall
              not extend leave.
            </li>
            <li>I shall intimate change in my above address, if any.</li>
            <li>
              I shall not undertake any employment abroad during the period of
              my leave / stay / abroad.
            </li>
            <li>
              I shall not leave the station / country unless the sanction has
              been communicated to me.
            </li>
            <li>
              I am submitting an undertaking on the prescribed form as per rules
              duly signed.
            </li>
          </ol>

          <div className="mt-5 space-y-3 text-right sm:mt-6 sm:space-y-4">
            <p>Yours faithfully,</p>
            <div className="space-y-2">
              <p>
                Signature{" "}
                <FilledUnderline value={form.letterSignature} width="w-56" />
              </p>
              <p>
                Name <FilledUnderline value={form.letterName} width="w-64" />
              </p>
              <p>
                Designation{" "}
                <FilledUnderline value={form.letterDesignation} width="w-60" />
              </p>
              <p>
                Department{" "}
                <FilledUnderline value={form.letterDepartment} width="w-60" />
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2 text-[12px] text-slate-900 sm:mt-6 sm:text-[13px]">
            <p>
              Dated: <FilledUnderline value={form.letterDated} width="w-40" />
            </p>
            <p>Recommendations of the Head of the Department</p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="mx-auto max-w-4xl space-y-4 border border-slate-300 bg-white p-3 sm:space-y-6 sm:p-4 md:p-6">
        <div className="flex justify-end text-[13px] font-semibold text-slate-900">
          Form - I
        </div>
        <div className="space-y-2 text-center text-[13px] text-slate-900">
          <p className="font-semibold underline">UNDERTAKING</p>
        </div>
        <div className="space-y-3 text-[12px] text-slate-900 sm:space-y-4 sm:text-[13px]">
          <p>
            I, <FilledUnderline value={form.u1Name} width="w-60" />,{" "}
            <FilledUnderline value={form.u1Designation} width="w-60" />
            (Designation) is proceeding on Ex-India Leave (EL) to{" "}
            <FilledUnderline value={form.u1Country} width="w-60" /> (Country)
            for <FilledUnderline value={form.u1Days} width="w-20" /> days from
            <FilledUnderline value={form.u1From} width="w-32" /> to{" "}
            <FilledUnderline value={form.u1To} width="w-32" />.
          </p>
          <p>
            I hereby certify that no Institute dues are outstanding against me.
            Further I undertake that if I did not return back on the due date
            i.e. <FilledUnderline value={form.u1DueDate} width="w-32" />, any
            dues of the Institute found later on, the same may be recovered from
            my payable balances available with the Institute.
          </p>
          <p>
            Date: <FilledUnderline value={form.u1Date} width="w-32" />
          </p>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-2 text-[13px] text-slate-900">
              <p className="font-semibold">Witness</p>
              <p>
                Signature{" "}
                <FilledUnderline value={form.u1WitnessSign} width="w-48" />
              </p>
              <p>
                Name <FilledUnderline value={form.u1WitnessName} width="w-48" />
              </p>
              <p>
                E. Code No.{" "}
                <FilledUnderline value={form.u1WitnessCode} width="w-40" />
              </p>
              <p>
                Department{" "}
                <FilledUnderline value={form.u1WitnessDept} width="w-48" />
              </p>
            </div>
            <div className="space-y-2 text-right text-[13px] text-slate-900">
              <p>
                Signature <FilledUnderline value={form.u1Sign} width="w-48" />
              </p>
              <p>
                Name: <FilledUnderline value={form.u1SignName} width="w-48" />
              </p>
              <p>
                Employee Code:{" "}
                <FilledUnderline value={form.u1SignCode} width="w-40" />
              </p>
              <p>
                Department:{" "}
                <FilledUnderline value={form.u1SignDept} width="w-48" />
              </p>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="mx-auto max-w-4xl space-y-4 border border-slate-300 bg-white p-3 sm:space-y-6 sm:p-4 md:p-6">
        <div className="flex justify-end text-[13px] font-semibold text-slate-900">
          Form - II
        </div>
        <div className="space-y-2 text-center text-[13px] text-slate-900">
          <p className="font-semibold underline">
            UNDERTAKING/ AGREEMENT FROM A MEMBER OF STAFF OF IIT ROPAR
            PROCEEDING ON LEAVE EX-INDIA
          </p>
        </div>
        <div className="space-y-4 text-[13px] text-slate-900">
          <p>
            Whereas, I, <FilledUnderline value={form.u2Name} width="w-60" />{" "}
            employed as Designation{" "}
            <FilledUnderline value={form.u2Designation} width="w-60" /> in the{" "}
            <FilledUnderline value={form.u2Dept} width="w-60" /> on Indian
            Institute of Technology, Ropar have applied for leave Ex-India for
            the period from <FilledUnderline value={form.u2From} width="w-32" />{" "}
            to <FilledUnderline value={form.u2To} width="w-32" /> for private
            work.
          </p>
          <p>
            And whereas Indian Institute of Technology, Ropar have agreed to
            grant me leave Ex-India Leave of the kind due for period from{" "}
            <FilledUnderline value={form.u2LeaveFrom} width="w-32" /> to{" "}
            <FilledUnderline value={form.u2LeaveTo} width="w-32" /> on the
            condition that no extension of the said leave shall be allowed.
          </p>
          <p>
            Now, therefore, I hereby declare and agree that the grant of leave
            on the condition mentioned above is acceptable to me and I hereby
            undertake and agree to abide by the same.
          </p>

          <div className="flex flex-wrap items-start justify-between gap-6 pt-4">
            <div className="space-y-2 text-[13px] text-slate-900">
              <p>
                Signature <FilledUnderline value={form.u2Sign} width="w-48" />
              </p>
              <p>
                Name <FilledUnderline value={form.u2SignName} width="w-48" />
              </p>
              <p>
                Department{" "}
                <FilledUnderline value={form.u2SignDept} width="w-48" />
              </p>
              <p>
                Designation{" "}
                <FilledUnderline value={form.u2SignDesignation} width="w-48" />
              </p>
            </div>

            <div className="space-y-2 text-[13px] text-slate-900">
              <p className="font-semibold">Signed in the presence of:</p>
              <div className="flex flex-wrap items-center gap-2">
                <span>Signature</span>
                <FilledUnderline value={form.u2Witness1Sign} width="w-44" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>Name</span>
                <FilledUnderline value={form.u2Witness1Name} width="w-44" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>Designation</span>
                <FilledUnderline
                  value={form.u2Witness1Designation}
                  width="w-44"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>Date</span>
                <FilledUnderline value={form.u2Witness1Date} width="w-36" />
              </div>
            </div>

            <div className="space-y-2 text-[13px] text-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <span>Signature</span>
                <FilledUnderline value={form.u2Witness2Sign} width="w-44" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>Name</span>
                <FilledUnderline value={form.u2Witness2Name} width="w-44" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>Designation</span>
                <FilledUnderline
                  value={form.u2Witness2Designation}
                  width="w-44"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>Date</span>
                <FilledUnderline value={form.u2Witness2Date} width="w-36" />
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
};

const NonAirIndiaPreview = ({ request }: { request: LeaveRequestDetails }) => {
  const form = request.formData ?? {};

  return (
    <SurfaceCard className="mx-auto max-w-3xl space-y-4 border border-slate-300 bg-white p-4 md:p-7">
      <PreviewHeader />
      <p className="text-center text-[12px] font-semibold uppercase text-slate-900">
        APPLICATION FOR PERMISSION TO TRAVEL BY AIRLINE OTHER THAN AIR INDIA
      </p>

      <div className="space-y-3 text-[12px] text-slate-900 sm:text-[13px]">
        <PreviewLine number="1." label="Name" value={form.name} />
        <PreviewLine number="2." label="Designation" value={form.designation} />
        <PreviewLine number="3." label="Department" value={form.department} />
        <div className="space-y-1">
          <p className="text-[12px] font-semibold text-slate-900">
            4. Visit dates
          </p>
          <div className="grid gap-2 rounded-2xl border border-slate-200/80 p-3 text-[12px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Onward journey:</span>
              <FilledUnderline
                value={formatFormDate(form.onwardJourney) || form.onwardJourney}
                width="w-36"
              />
              <FilledUnderline
                value={form.onwardSession}
                width="w-28"
                align="text-center"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Return journey:</span>
              <FilledUnderline
                value={formatFormDate(form.returnJourney) || form.returnJourney}
                width="w-36"
              />
              <FilledUnderline
                value={form.returnSession}
                width="w-28"
                align="text-center"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Total days:</span>
              <FilledUnderline
                value={form.travelDays}
                width="w-20"
                align="text-center"
              />
            </div>
          </div>
        </div>
        <PreviewLine
          number="5."
          label="Place to be visited"
          value={form.placeToVisit}
        />
        <PreviewLine number="6." label="Purpose" value={form.purpose} />
        <PreviewLine
          number="7."
          label="Sectors for which permission is sought"
          value={form.sectors}
        />
        <PreviewLine
          number="8."
          label="Reason for travel by airline other than Air India"
          value={form.reason}
        />
        <PreviewLine
          number="9."
          label="Permission sought from MHRD (Yes/No)"
          value={form.permissionMhrd}
        />
        <PreviewLine
          number="10."
          label="Budget head (Institute/Project)"
          value={form.budgetHead}
        />
      </div>

      <p className="text-right text-[12px] text-slate-900">
        Applicant signature:{" "}
        <FilledUnderline value={form.applicantSignature} width="w-64" />
      </p>
    </SurfaceCard>
  );
};

const LtcPreview = ({ request }: { request: LeaveRequestDetails }) => {
  const form = request.formData ?? {};

  const getValue = (key: string) => form[key] ?? "";

  const getDate = (key: string) => formatFormDate(form[key]) || form[key] || "";

  const hasAnyValue = (keys: string[]) =>
    keys.some((key) => (form[key] ?? "").trim().length > 0);

  const applicantKeys = [
    "formLanguage",
    "employeeName",
    "designation",
    "dateOfJoining",
    "payLevel",
    "leaveNature",
    "leaveFrom",
    "leaveFromSession",
    "leaveTo",
    "leaveToSession",
    "leaveDays",
    "prefixFrom",
    "prefixTo",
    "suffixFrom",
    "suffixTo",
    "spouseLtc",
    "selfOutward",
    "selfInward",
    "familyOutward",
    "familyInward",
    "homeTown",
    "ltcNature",
    "placeToVisit",
    "estimatedFare",
    "advanceRequired",
    "encashmentRequired",
    "encashmentDays",
    "blockYear",
    "applicantSignature",
  ];

  const personsKeys = Array.from({ length: 5 }).flatMap((_, index) => {
    const idx = index + 1;
    return [
      `person${idx}Name`,
      `person${idx}Age`,
      `person${idx}Relation`,
      `person${idx}From`,
      `person${idx}To`,
      `person${idx}Back`,
      `person${idx}Mode`,
    ];
  });

  const establishmentKeys = [
    "freshRecruitDate",
    "estBlockYear",
    "estNatureParticular",
    "estNatureLast",
    "estNatureCurrent",
    "estPeriodFrom",
    "estPeriodTo",
    "estPeriodLast",
    "estPeriodCurrent",
    "estSelfFamilyParticular",
    "estSelfFamilyLast",
    "estSelfFamilyCurrent",
    "estEncashParticular",
    "estEncashLast",
    "estEncashCurrent",
    "estEarnedLeaveCreditOn",
    "estEarnedLeaveStanding",
    "estEarnedLeaveBalanceAfterEncashment",
    "estEarnedLeaveEncashmentAdmissible",
    "estLeaveLast",
    "estLeaveCurrent",
    "estPeriodNatureParticular",
    "estPeriodNatureLast",
    "estPeriodNatureCurrent",
  ];

  const accountsKeys = [
    ...Array.from({ length: 4 }).flatMap((_, index) => {
      const row = index + 1;
      return [
        `accountsFrom${row}`,
        `accountsTo${row}`,
        `accountsMode${row}`,
        `accountsFares${row}`,
        `accountsSingleFare${row}`,
        `accountsAmount${row}`,
      ];
    }),
    "accountsTotal",
    "accountsAdmissible",
    "accountsPassed",
    "accountsInWords",
    "accountsDebitable",
  ];

  const auditKeys = ["auditComments", "auditRecommended", "auditApproved"];

  const officeKeys = [...establishmentKeys, ...accountsKeys, ...auditKeys];
  const showOfficeSections = hasAnyValue(officeKeys);

  const shownAllKeys = new Set<string>([
    ...applicantKeys,
    ...personsKeys,
    ...officeKeys,
  ]);

  const remainingEntries = Object.entries(form)
    .filter(([key, value]) => {
      if (!value || !value.trim()) return false;
      return !shownAllKeys.has(key);
    })
    .sort(([a], [b]) => a.localeCompare(b));

  const leaveFrom = getDate("leaveFrom");
  const leaveTo = getDate("leaveTo");
  const leaveFromSession = getValue("leaveFromSession");
  const leaveToSession = getValue("leaveToSession");

  return (
    <div className="space-y-4">
      <SurfaceCard className="mx-auto max-w-5xl space-y-4 border border-slate-300 bg-white p-4 md:p-6">
        <div className="flex justify-end">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Language</span>
            <FilledUnderline value={getValue("formLanguage")} width="w-24" />
          </div>
        </div>

        <PreviewHeader />
        <p className="text-center text-[12px] font-semibold text-slate-900">
          APPLICATION FOR LEAVE TRAVEL CONCESSION (LTC) /
          <span className="ml-2">छुट्टी यात्रा रियायत हेतु आवेदन</span>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border border-slate-400 text-[12px] text-slate-900">
            <tbody>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  1.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Name of the Employee with Employee Code /
                      <span className="ml-1">
                        कर्मचारी का नाम एवं कर्मचारी कोड
                      </span>
                    </span>
                    <FilledUnderline
                      value={getValue("employeeName")}
                      width="w-80"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  2.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Designation and Department /
                      <span className="ml-1">पदनाम और विभाग</span>
                    </span>
                    <FilledUnderline
                      value={getValue("designation")}
                      width="w-96"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  3.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Date of entering the Central Government Service/Date of
                      joining with IIT Ropar /
                      <span className="ml-1">
                        केन्द्रीय सरकार सेवा में प्रवेश की तिथि/आईआईटी रोपड़ में
                        जॉइनिंग की तिथि
                      </span>
                    </span>
                    <FilledUnderline
                      value={getDate("dateOfJoining")}
                      width="w-52"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  4.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Pay Level / <span className="ml-1">वेतन स्तर</span>
                    </span>
                    <FilledUnderline
                      value={getValue("payLevel")}
                      width="w-48"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  5.
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        Leave required /{" "}
                        <span className="ml-1">छुट्टी की आवश्यकता</span>
                      </span>
                      <span>Nature / प्रकृति:</span>
                      <FilledUnderline
                        value={getValue("leaveNature")}
                        width="w-44"
                      />
                      <span>From / से</span>
                      <FilledUnderline value={leaveFrom} width="w-36" />
                      <FilledUnderline
                        value={leaveFromSession}
                        width="w-28"
                        align="text-center"
                      />
                      <span>To / तक</span>
                      <FilledUnderline value={leaveTo} width="w-36" />
                      <FilledUnderline
                        value={leaveToSession}
                        width="w-28"
                        align="text-center"
                      />
                      <span>No. of days / दिनों की संख्या</span>
                      <FilledUnderline
                        value={getValue("leaveDays")}
                        width="w-20"
                        align="text-center"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Prefix / पूर्व:</span>
                      <span>From</span>
                      <FilledUnderline
                        value={getDate("prefixFrom")}
                        width="w-36"
                      />
                      <span>To</span>
                      <FilledUnderline
                        value={getDate("prefixTo")}
                        width="w-36"
                      />
                      <span>Suffix / पश्च:</span>
                      <span>From</span>
                      <FilledUnderline
                        value={getDate("suffixFrom")}
                        width="w-36"
                      />
                      <span>To</span>
                      <FilledUnderline
                        value={getDate("suffixTo")}
                        width="w-36"
                      />
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  6.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Whether spouse is employed, if yes whether entitled to LTC
                      /
                      <span className="ml-1">
                        क्या जीवनसाथी नियोजित है, यदि हां तो क्या LTC के लिए
                        पात्र है
                      </span>
                    </span>
                    <FilledUnderline
                      value={getValue("spouseLtc")}
                      width="w-72"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  7.
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold">
                    Proposed dates of Journey /{" "}
                    <span className="ml-1">यात्रा की प्रस्तावित तिथियां</span>
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full border border-slate-400 text-[12px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            &nbsp;
                          </th>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            Date of Outward journey / बाह्य यात्रा की तिथि
                          </th>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            Date of Inward journey / आंतरिक यात्रा की तिथि
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-400 px-2 py-1 font-semibold">
                            Self / स्वयं
                          </td>
                          <td className="border border-slate-400 px-2 py-1">
                            <FilledUnderline
                              value={getDate("selfOutward")}
                              width="w-full"
                            />
                          </td>
                          <td className="border border-slate-400 px-2 py-1">
                            <FilledUnderline
                              value={getDate("selfInward")}
                              width="w-full"
                            />
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 px-2 py-1 font-semibold">
                            Family / परिवार
                          </td>
                          <td className="border border-slate-400 px-2 py-1">
                            <FilledUnderline
                              value={getDate("familyOutward")}
                              width="w-full"
                            />
                          </td>
                          <td className="border border-slate-400 px-2 py-1">
                            <FilledUnderline
                              value={getDate("familyInward")}
                              width="w-full"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  8.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Home Town as recorded in the Service Book /
                      <span className="ml-1">
                        गृह नगर सेवा पुस्तिका में दर्ज
                      </span>
                    </span>
                    <FilledUnderline
                      value={getValue("homeTown")}
                      width="w-80"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  9.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Nature of LTC to be availed:- Home Town/ Anywhere in India
                      /
                      <span className="ml-1">
                        एलटीसी का प्रकार: गृह नगर/भारत में कहीं भी
                      </span>
                    </span>
                    <FilledUnderline
                      value={getValue("ltcNature")}
                      width="w-80"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  10.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Place to be visited /{" "}
                      <span className="ml-1">भ्रमण का स्थान</span>
                    </span>
                    <FilledUnderline
                      value={getValue("placeToVisit")}
                      width="w-80"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  11.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Total Estimated fare of entitled class for to and fro
                      journey (proof need to be attached). /
                      <span className="ml-1">
                        आवक-जावक यात्रा के लिए पात्र श्रेणी का अनुमानित किराया
                      </span>
                    </span>
                    <FilledUnderline
                      value={getValue("estimatedFare")}
                      width="w-72"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  12.
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold">
                    Person(s) in respect of whom LTC is proposed to be availed.
                    /
                    <span className="ml-1">
                      जिन व्यक्तियों के लिए एलटीसी प्रस्तावित है
                    </span>
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full border border-slate-400 text-[11px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="w-10 border border-slate-400 px-2 py-1 text-left">
                            Sr.
                          </th>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            Name
                          </th>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            Age
                          </th>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            Relationship
                          </th>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            Travelling (Place) From
                          </th>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            To
                          </th>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            Back (Yes/No)
                          </th>
                          <th className="border border-slate-400 px-2 py-1 text-left">
                            Mode of Travel
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: "i", idx: 1 },
                          { key: "ii", idx: 2 },
                          { key: "iii", idx: 3 },
                          { key: "iv", idx: 4 },
                          { key: "v", idx: 5 },
                        ].map((row) => (
                          <tr key={row.key}>
                            <td className="border border-slate-400 px-2 py-1 font-semibold">
                              ({row.key})
                            </td>
                            <td className="border border-slate-400 px-2 py-1">
                              <FilledUnderline
                                value={getValue(`person${row.idx}Name`)}
                                width="w-full"
                              />
                            </td>
                            <td className="border border-slate-400 px-2 py-1">
                              <FilledUnderline
                                value={getValue(`person${row.idx}Age`)}
                                width="w-full"
                              />
                            </td>
                            <td className="border border-slate-400 px-2 py-1">
                              <FilledUnderline
                                value={getValue(`person${row.idx}Relation`)}
                                width="w-full"
                              />
                            </td>
                            <td className="border border-slate-400 px-2 py-1">
                              <FilledUnderline
                                value={getValue(`person${row.idx}From`)}
                                width="w-full"
                              />
                            </td>
                            <td className="border border-slate-400 px-2 py-1">
                              <FilledUnderline
                                value={getValue(`person${row.idx}To`)}
                                width="w-full"
                              />
                            </td>
                            <td className="border border-slate-400 px-2 py-1">
                              <FilledUnderline
                                value={getValue(`person${row.idx}Back`)}
                                width="w-full"
                              />
                            </td>
                            <td className="border border-slate-400 px-2 py-1">
                              <FilledUnderline
                                value={getValue(`person${row.idx}Mode`)}
                                width="w-full"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  13.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Advance Required / अग्रिम आवश्यक
                    </span>
                    <FilledUnderline
                      value={getValue("advanceRequired")}
                      width="w-32"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-t border-slate-400">
                <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
                  14.
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Encashment of earned leave required. / अर्जित अवकाश
                      नकदीकरण आवश्यक
                    </span>
                    <FilledUnderline
                      value={getValue("encashmentRequired")}
                      width="w-32"
                    />
                    <FilledUnderline
                      value={getValue("encashmentDays")}
                      width="w-20"
                      align="text-center"
                    />
                    <span>days / दिन</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-3 text-[12px] text-slate-900">
          <p className="font-semibold">Undertaking / प्रतिज्ञा</p>
          <p className="flex flex-wrap items-center gap-2">
            <span>
              Spouse LTC declaration for block year / जीवनसाथी घोषणा - Block
              year:
            </span>
            <FilledUnderline value={getValue("blockYear")} width="w-32" />
          </p>
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              Forwarded please / कृपया अग्रेषित करें
            </span>
            <span className="flex items-center gap-2">
              <span>Applicant signature / आवेदक हस्ताक्षर:</span>
              <FilledUnderline
                value={getValue("applicantSignature")}
                width="w-64"
              />
            </span>
          </p>
        </div>
      </SurfaceCard>

      {showOfficeSections ? (
        <SurfaceCard className="mx-auto max-w-5xl space-y-6 border border-slate-300 bg-white p-4 md:p-6">
          <p className="text-center text-[12px] font-semibold text-slate-900">
            Office sections (filled so far)
          </p>

          {hasAnyValue(establishmentKeys) ? (
            <div className="space-y-3 text-[12px] text-slate-900">
              <div className="text-center font-semibold">
                (A) FOR USE OF ESTABLISHMENT SECTION
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>Fresh Recruit / Date of joining:</span>
                <FilledUnderline
                  value={getDate("freshRecruitDate")}
                  width="w-40"
                />
                <span>Block year:</span>
                <FilledUnderline
                  value={getValue("estBlockYear")}
                  width="w-28"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border border-slate-400 text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="w-14 border border-slate-400 px-2 py-1 text-left">
                        Sl. No.
                      </th>
                      <th className="border border-slate-400 px-2 py-1 text-left">
                        Particulars
                      </th>
                      <th className="border border-slate-400 px-2 py-1 text-left">
                        Last availed
                      </th>
                      <th className="border border-slate-400 px-2 py-1 text-left">
                        Current LTC
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-400 px-2 py-1 font-semibold">
                        01
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <div className="space-y-1">
                          <div>
                            Nature of LTC (Home Town/Anywhere in India-place
                            visited/to be visited)
                          </div>
                          <FilledUnderline
                            value={getValue("estNatureParticular")}
                            width="w-full"
                          />
                        </div>
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estNatureLast")}
                          width="w-full"
                        />
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estNatureCurrent")}
                          width="w-full"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 px-2 py-1 font-semibold">
                        02
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <span>Period (from </span>
                        <FilledUnderline
                          value={getValue("estPeriodFrom")}
                          width="w-20"
                        />
                        <span> to </span>
                        <FilledUnderline
                          value={getValue("estPeriodTo")}
                          width="w-20"
                        />
                        <span>)</span>
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estPeriodLast")}
                          width="w-full"
                        />
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estPeriodCurrent")}
                          width="w-full"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 px-2 py-1 font-semibold">
                        03
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <div className="space-y-1">
                          <div>LTC for Self/Family</div>
                          <FilledUnderline
                            value={getValue("estSelfFamilyParticular")}
                            width="w-full"
                          />
                        </div>
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estSelfFamilyLast")}
                          width="w-full"
                        />
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estSelfFamilyCurrent")}
                          width="w-full"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 px-2 py-1 font-semibold">
                        04
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <div className="space-y-1">
                          <div>Earned leave encashment (No. of Days)</div>
                          <FilledUnderline
                            value={getValue("estEncashParticular")}
                            width="w-full"
                          />
                        </div>
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estEncashLast")}
                          width="w-full"
                        />
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estEncashCurrent")}
                          width="w-full"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 px-2 py-1 font-semibold">
                        05
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span>Earned Leave standing to his credit on</span>
                            <FilledUnderline
                              value={getValue("estEarnedLeaveCreditOn")}
                              width="w-24"
                            />
                            <span>=</span>
                            <FilledUnderline
                              value={getValue("estEarnedLeaveStanding")}
                              width="w-24"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span>
                              Balance Earned leave after this encashment
                            </span>
                            <span>=</span>
                            <FilledUnderline
                              value={getValue(
                                "estEarnedLeaveBalanceAfterEncashment",
                              )}
                              width="w-28"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span>Earned Leave encashment admissible</span>
                            <span>=</span>
                            <FilledUnderline
                              value={getValue(
                                "estEarnedLeaveEncashmentAdmissible",
                              )}
                              width="w-28"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estLeaveLast")}
                          width="w-full"
                        />
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estLeaveCurrent")}
                          width="w-full"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 px-2 py-1 font-semibold">
                        06
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <div className="space-y-1">
                          <div>
                            Period and nature of leave applied for and need to
                            be sanctioned
                          </div>
                          <FilledUnderline
                            value={getValue("estPeriodNatureParticular")}
                            width="w-full"
                          />
                        </div>
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estPeriodNatureLast")}
                          width="w-full"
                        />
                      </td>
                      <td className="border border-slate-400 px-2 py-1">
                        <FilledUnderline
                          value={getValue("estPeriodNatureCurrent")}
                          width="w-full"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {hasAnyValue(accountsKeys) ? (
            <div className="space-y-3 text-[12px] text-slate-900">
              <div className="text-center font-semibold">
                (B) For use by the Accounts Section
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border border-slate-400 text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border border-slate-400 px-2 py-1 text-left">
                        From
                      </th>
                      <th className="border border-slate-400 px-2 py-1 text-left">
                        To
                      </th>
                      <th className="border border-slate-400 px-2 py-1 text-left">
                        Mode of Travel
                      </th>
                      <th className="border border-slate-400 px-2 py-1 text-left">
                        No. of fares
                      </th>
                      <th className="border border-slate-400 px-2 py-1 text-left">
                        Single fare
                      </th>
                      <th className="border border-slate-400 px-2 py-1 text-left">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4].map((row) => (
                      <tr key={row}>
                        <td className="border border-slate-400 px-2 py-1">
                          <FilledUnderline
                            value={getValue(`accountsFrom${row}`)}
                            width="w-full"
                          />
                        </td>
                        <td className="border border-slate-400 px-2 py-1">
                          <FilledUnderline
                            value={getValue(`accountsTo${row}`)}
                            width="w-full"
                          />
                        </td>
                        <td className="border border-slate-400 px-2 py-1">
                          <FilledUnderline
                            value={getValue(`accountsMode${row}`)}
                            width="w-full"
                          />
                        </td>
                        <td className="border border-slate-400 px-2 py-1">
                          <FilledUnderline
                            value={getValue(`accountsFares${row}`)}
                            width="w-full"
                          />
                        </td>
                        <td className="border border-slate-400 px-2 py-1">
                          <FilledUnderline
                            value={getValue(`accountsSingleFare${row}`)}
                            width="w-full"
                          />
                        </td>
                        <td className="border border-slate-400 px-2 py-1">
                          <FilledUnderline
                            value={getValue(`accountsAmount${row}`)}
                            width="w-full"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 text-[11px]">
                <p>
                  Total Rs.{" "}
                  <FilledUnderline
                    value={getValue("accountsTotal")}
                    width="w-40"
                  />
                </p>
                <p>
                  Advance admissible (90% of above) = Rs.{" "}
                  <FilledUnderline
                    value={getValue("accountsAdmissible")}
                    width="w-32"
                  />{" "}
                  Passed for Rs.{" "}
                  <FilledUnderline
                    value={getValue("accountsPassed")}
                    width="w-32"
                  />
                </p>
                <p>
                  (in words); Rupees{" "}
                  <FilledUnderline
                    value={getValue("accountsInWords")}
                    width="w-64"
                  />
                </p>
                <p>
                  Debitable to LTC advance Dr./Mr./Mrs./Ms{" "}
                  <FilledUnderline
                    value={getValue("accountsDebitable")}
                    width="w-64"
                  />
                </p>
              </div>
            </div>
          ) : null}

          {hasAnyValue(auditKeys) ? (
            <div className="space-y-3 text-[12px] text-slate-900">
              <div className="text-center font-semibold">
                (C) For use by the Audit Section
              </div>
              <div className="border border-slate-400 p-3 text-[11px]">
                <p>Comments/Observations:</p>
                <FilledUnderline
                  value={getValue("auditComments")}
                  width="w-full"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                <div className="flex items-center gap-2">
                  <span>Recommended & Forwarded</span>
                  <FilledUnderline
                    value={getValue("auditRecommended")}
                    width="w-40"
                  />
                  <span>Registrar</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Approved/Not Approved</span>
                  <FilledUnderline
                    value={getValue("auditApproved")}
                    width="w-40"
                  />
                  <span>Dean (F&A)</span>
                </div>
              </div>
            </div>
          ) : null}
        </SurfaceCard>
      ) : null}

      {remainingEntries.length ? (
        <SurfaceCard className="mx-auto max-w-5xl space-y-3 border border-slate-200 bg-white p-4 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Additional fields
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border border-slate-200 text-[12px] text-slate-900">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border border-slate-200 px-3 py-2 text-left">
                    Field
                  </th>
                  <th className="border border-slate-200 px-3 py-2 text-left">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {remainingEntries.map(([key, value]) => (
                  <tr key={key} className="border-t border-slate-200">
                    <td className="w-60 bg-slate-50 px-3 py-2 align-top font-semibold">
                      {formatFieldLabel(key)}
                      <div className="mt-0.5 text-[11px] font-normal text-slate-500">
                        {key}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
};

const EarnedLeavePreview = ({ request }: { request: LeaveRequestDetails }) => {
  const form = request.formData ?? {};
  const ltcValue = (form.ltc ?? "").toUpperCase();
  const stationRequired = (form.stationYesNo ?? "").toLowerCase() === "yes";

  return (
    <SurfaceCard className="mx-auto max-w-4xl space-y-5 border border-slate-300 bg-white p-4 md:p-6">
      <PreviewHeader />
      <p className="text-center text-[12px] font-semibold text-slate-900">
        छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन / Application for Leave or
        Extension of Leave
      </p>
      <p className="text-center text-[11px] text-slate-700">
        (अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड छुट्टी/विश्राम
        की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल देखभाल छुट्टी)
      </p>
      <p className="text-center text-[11px] text-slate-700">
        (Earned Leave/Half Pay Leave/Extra Ordinary Leave/Commuted
        Leave/Vacation/Maternity Leave/Paternity Leave/Child Care Leave)
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border border-slate-400 text-[12px] text-slate-900">
          <tbody>
            <PreviewRow
              label="1. आवेदक का नाम / Name of the applicant"
              value={form.name}
            />
            <PreviewRow label="2. पद नाम / Post held" value={form.post} />
            <PreviewRow
              label="3. विभाग/केन्द्रीय कार्यालय/अनुभाग / Department/Office/Section"
              value={form.department}
            />
            <PreviewRow
              label="4. अवकाश का प्रकार / Nature of Leave applied for"
              value={form.leaveType}
            />
            <tr className="border-t border-slate-400">
              <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
                5. छुट्टी की अवधि/ Period of Leave
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span>से / From:</span>
                  <FilledUnderline
                    value={formatFormDate(form.fromDate) || form.fromDate}
                    width="w-32"
                  />
                  <span>तक/To:</span>
                  <FilledUnderline
                    value={formatFormDate(form.toDate) || form.toDate}
                    width="w-32"
                  />
                  <span>दिनों की संख्या/No. of days:</span>
                  <FilledUnderline value={form.days} width="w-20" />
                </div>
              </td>
            </tr>
            <tr className="border-t border-slate-400">
              <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
                6. यदि कोई, रविवार और अवकाश, छुट्टी से पूर्व या पश्चात में लिए
                जा रहे हैं
                <div className="text-[11px] font-normal">
                  Sunday and holiday, if any, proposed to be prefixed/suffixed
                  to leave
                </div>
              </td>
              <td className="space-y-2 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span>के पूर्व Prefix</span>
                  <span>से/From:</span>
                  <FilledUnderline
                    value={
                      formatFormDate(form.prefixFromDate) || form.prefixFromDate
                    }
                    width="w-28"
                  />
                  <span>तक/To:</span>
                  <FilledUnderline
                    value={
                      formatFormDate(form.prefixToDate) || form.prefixToDate
                    }
                    width="w-28"
                  />
                  <span>दिनों की संख्या:</span>
                  <FilledUnderline value={form.prefixDays} width="w-20" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>के पश्चात Suffix</span>
                  <span>से/From:</span>
                  <FilledUnderline
                    value={
                      formatFormDate(form.suffixFromDate) || form.suffixFromDate
                    }
                    width="w-28"
                  />
                  <span>तक/To:</span>
                  <FilledUnderline
                    value={
                      formatFormDate(form.suffixToDate) || form.suffixToDate
                    }
                    width="w-28"
                  />
                  <span>दिनों की संख्या:</span>
                  <FilledUnderline value={form.suffixDays} width="w-20" />
                </div>
              </td>
            </tr>
            <PreviewRow label="7. उद्देश्य / Purpose" value={form.purpose} />
            <PreviewRow
              label="8. कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था / Alternative arrangements"
              value={form.arrangements}
            />
            <PreviewRow
              label="9. I propose/do not propose to avail Leave Travel Concession during the leave."
              value={
                ltcValue === "PROPOSE"
                  ? "Propose"
                  : ltcValue === "NOT_PROPOSE"
                    ? "Do not propose"
                    : form.ltc
              }
            />
            <tr className="border-t border-slate-400">
              <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
                10. अवकाश के दौरान पता / Address during the leave
              </td>
              <td className="space-y-2 px-3 py-2">
                <div>
                  <FilledUnderline value={form.address} width="w-full" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>संपर्क नं. / Contact No.</span>
                  <FilledUnderline value={form.contactNo} width="w-40" />
                  <span>पिन / PIN:</span>
                  <FilledUnderline value={form.pin} width="w-24" />
                </div>
              </td>
            </tr>
            <tr className="border-t border-slate-400">
              <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
                11. क्या स्टेशन अवकाश की आवश्यकता है / Whether Station leave is
                required
              </td>
              <td className="space-y-2 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span>हाँ / Yes / No:</span>
                  <FilledUnderline value={form.stationYesNo} width="w-24" />
                </div>
                {stationRequired ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>यदि हाँ / If yes : From</span>
                    <FilledUnderline
                      value={
                        formatFormDate(form.stationFrom) || form.stationFrom
                      }
                      width="w-28"
                    />
                    <span>To</span>
                    <FilledUnderline
                      value={formatFormDate(form.stationTo) || form.stationTo}
                      width="w-28"
                    />
                  </div>
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-right text-[12px] text-slate-900">
        आवेदक के हस्ताक्षर दिनांक सहित / Signature of the applicant with date:
        <span className="ml-2 inline-flex items-center gap-2">
          <FilledUnderline value={form.applicantSignature} width="w-40" />
          <FilledUnderline
            value={
              formatFormDate(form.applicantSignatureDate) ||
              form.applicantSignatureDate
            }
            width="w-32"
          />
        </span>
      </p>

      <div className="space-y-2 border-t border-slate-400 pt-2 text-[12px] text-slate-900">
        <p className="text-center font-semibold">
          नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें / Remarks and
          Recommendations of the controlling officer
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span>
            सिफारिश की गई / Recommended या नहीं की गई / not recommended:
          </span>
          <FilledUnderline value={form.recommended} width="w-44" />
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span>
            विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित / Signature
            with date Head of Department/Section In-charge:
          </span>
          <FilledUnderline value={form.hodSignature} width="w-60" />
        </p>
      </div>

      <div className="space-y-2 border-t border-slate-400 pt-2 text-[12px] text-slate-900">
        <p className="text-center font-semibold">
          प्रशासनिक अनुभाग द्वारा प्रयोग हेतु / For use by the Administration
          Section
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span>Certified that (nature of leave) for period, from</span>
          <FilledUnderline value={form.adminFrom} width="w-32" />
          <span>to</span>
          <FilledUnderline value={form.adminTo} width="w-32" />
          <span>is available as per following details.</span>
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span>Nature of leave applied for</span>
          <FilledUnderline value={form.adminLeaveType} width="w-44" />
          <span>Balance as on date</span>
          <FilledUnderline value={form.balance} width="w-28" />
          <span>Leave applied for (No. of days)</span>
          <FilledUnderline value={form.adminDays} width="w-24" />
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span>Dealing Assistant</span>
          <FilledUnderline value={form.assistant} width="w-44" />
          <span>AR/DR</span>
          <FilledUnderline value={form.arDr} width="w-44" />
          <span>Registrar</span>
          <FilledUnderline value={form.registrar} width="w-44" />
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span>
            Signature of Registrar / Dean (Faculty Affairs & Administration) /
            Director:
          </span>
          <FilledUnderline value={form.authoritySign} width="w-60" />
        </p>
      </div>
    </SurfaceCard>
  );
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

const PreviewRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">{label}</td>
    <td className="px-3 py-2">
      <FilledUnderline value={value} width="w-full" />
    </td>
  </tr>
);
