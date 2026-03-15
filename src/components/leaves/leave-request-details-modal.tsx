"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { downloadFormAsPdf } from "@/lib/pdf-export";

export type LeaveApprovalTrailItem = {
  sequence: number;
  actor: string;
  status: string;
  assignedTo: string | null;
  actedAt: string | null;
  remarks: string | null;
  recommended?: string | null;
  hodSignature?: string | null;
  accountsSignature?: string | null;
  balance?: string | null;
  decisionDate?: string | null;
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

  const formEntries = Object.entries(request.formData ?? {}).filter(
    ([, value]) => value != null && `${value}`.trim() !== "",
  );
  const professionalSummary = buildProfessionalSummary(request);
  const hasFormPreview =
    // show full form for station leave (SL), joining report (JR), or when request has
    // form data and has already been approved. Approved records are often reviewed
    // later by applicants or controllers so the original data should be visible.
    Boolean(request.formData && Object.keys(request.formData).length > 0) &&
    (request.status === "APPROVED" ||
      isEarnedLeaveType(request) ||
      request.leaveTypeCode === "SL" ||
      request.leaveTypeCode === "JR");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-8">
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
                    {(step.recommended ||
                      step.hodSignature ||
                      step.accountsSignature ||
                      step.balance ||
                      step.decisionDate) && (
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
    <div className="space-y-3 rounded-2xl border border-slate-200/80 p-4">
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
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 p-4">
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

  if (isEarnedLeaveType(request)) {
    return <EarnedLeavePreview request={request} />;
  }

  return null;
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
