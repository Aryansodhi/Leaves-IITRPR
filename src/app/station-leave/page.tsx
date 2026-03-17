"use client";

import type { ChangeEvent, FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useRef, useState, forwardRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SignatureOtpVerificationCard } from "../../components/leaves/signature-otp-verification-card";
import {
  DIGITAL_SIGNATURE_VALUE,
  useSignatureOtp,
} from "@/components/leaves/use-signature-otp";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { applyAutofillToForm, saveFormDraft } from "@/lib/form-autofill";
import { downloadFormAsPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;
type DaySession = "MORNING" | "AFTERNOON" | "EVENING";

const SESSION_OFFSET: Record<DaySession, number> = {
  MORNING: 0,
  AFTERNOON: 0.5,
  EVENING: 1,
};

const getTodayIso = () => new Date().toISOString().slice(0, 10);

const resolveCurrentSession = (): DaySession => {
  const hour = new Date().getHours();
  if (hour < 12) return "MORNING";
  if (hour < 17) return "AFTERNOON";
  return "EVENING";
};

const computeSessionLeaveDays = (
  fromDate: string,
  fromSession: DaySession,
  toDate: string,
  toSession: DaySession,
) => {
  if (!fromDate || !toDate) return null;

  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

  const fromMarker = from.getTime() / 86400000 + SESSION_OFFSET[fromSession];
  const toMarker = to.getTime() / 86400000 + SESSION_OFFSET[toSession];
  const value = Number((toMarker - fromMarker).toFixed(1));
  if (value <= 0) return null;

  return value;
};

const formatDays = (value: number) =>
  Number.isInteger(value) ? `${value}` : value.toFixed(1);

type StationLeaveHistoryItem = {
  id: string;
  referenceCode: string;
  from: string;
  to: string;
  totalDays: number;
  status: string;
  submittedAt: string;
  approver: string;
};

const ROLE_KEYS = {
  FACULTY: "FACULTY",
  STAFF: "STAFF",
  HOD: "HOD",
  DEAN: "DEAN",
  REGISTRAR: "REGISTRAR",
} as const;

const requiredInputIds = [
  "name",
  "designation",
  "department",
  "from",
  "fromSession",
  "to",
  "toSession",
  "nature",
  "purpose",
  "contactPrefix",
  "contactNumber",
  "contactAddress",
  "place",
  "date",
];

const UnderlineInput = forwardRef<
  HTMLInputElement,
  {
    id: string;
    width?: string;
    className?: string;
  } & InputHTMLAttributes<HTMLInputElement>
>(({ id, width = "w-72", className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    id={id}
    name={id}
    type={type}
    className={cn(
      "border-0 border-b border-dashed border-slate-500 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
    {...props}
  />
));
UnderlineInput.displayName = "UnderlineInput";

const COUNTRY_CODE_OPTIONS = [
  { value: "+91", label: "India (+91)" },
  { value: "+1", label: "USA / Canada (+1)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+61", label: "Australia (+61)" },
  { value: "+65", label: "Singapore (+65)" },
  { value: "+971", label: "UAE (+971)" },
] as const;

export default function StationLeavePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const formRef = useRef<HTMLFormElement>(null);
  const printableRef = useRef<HTMLDivElement>(null);
  const pendingDataRef = useRef<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoleLocked, setIsRoleLocked] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<StationLeaveHistoryItem[]>([]);
  const signature = useSignatureOtp({ enableTyped: true });
  const setOtpEmail = signature.setOtpEmail;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fromSession, setFromSession] = useState<DaySession>("MORNING");
  const [toSession, setToSession] = useState<DaySession>("EVENING");
  const [computedLeaveDays, setComputedLeaveDays] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState(
    "On submit, this request is routed to your authority automatically.",
  );

  const markMissingInputs = (form: HTMLFormElement, missing: Set<string>) => {
    const inputs = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input, select",
      ),
    );
    inputs.forEach((input) => {
      const key = input.name || input.id;
      const hasError = key ? missing.has(key) : false;
      input.classList.toggle("border-red-500", hasError);
      input.classList.toggle("focus:border-red-600", hasError);
      input.classList.toggle("ring-1", hasError);
      input.classList.toggle("ring-red-300", hasError);
      input.classList.toggle("focus:ring-red-400", hasError);
      input.classList.toggle("bg-red-50", hasError);
      input.setAttribute("aria-invalid", hasError ? "true" : "false");
    });
  };

  useEffect(() => {
    const value = computeSessionLeaveDays(
      fromDate,
      fromSession,
      toDate,
      toSession,
    );
    setComputedLeaveDays(value ? formatDays(value) : "");
  }, [fromDate, fromSession, toDate, toSession]);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    if (toDate < fromDate) {
      setToDate(fromDate);
      setToSession("EVENING");
      return;
    }

    if (
      toDate === fromDate &&
      SESSION_OFFSET[toSession] <= SESSION_OFFSET[fromSession]
    ) {
      setToSession(
        fromSession === "MORNING"
          ? "AFTERNOON"
          : fromSession === "AFTERNOON"
            ? "EVENING"
            : "EVENING",
      );
    }
  }, [fromDate, fromSession, toDate, toSession]);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      const safeReturnTo =
        returnTo && returnTo.startsWith("/") ? returnTo : "/";
      router.push(safeReturnTo);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRoleLocked) {
      setSubmitError("Station leave form is locked for Dean and Registrar.");
      return;
    }
    setConfirmed(false);
    setSubmitError(null);
    const form = formRef.current;
    if (!form) return;
    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const contactPrefix = (data.contactPrefix ?? "+91").trim();
    const contactNumber = (data.contactNumber ?? "").replace(/\D/g, "");

    data.contactPrefix = contactPrefix;
    data.contactNumber = contactNumber;
    data.contact = `${contactPrefix} ${contactNumber}`.trim();
    data.fromSession = fromSession;
    data.toSession = toSession;
    data.days = computedLeaveDays;
    data.applicantSign =
      signature.signatureMode === "typed"
        ? signature.typedSignature.trim()
        : DIGITAL_SIGNATURE_VALUE;

    saveFormDraft("station-leave", data);
    const missing = requiredInputIds.filter((key) => !data[key]?.trim());
    const invalid = new Set<string>();

    if (
      !/^\d+(\.5)?$/.test(data.days ?? "") ||
      Number.parseFloat(data.days) <= 0
    ) {
      invalid.add("days");
    }

    if (!/^\d{10}$/.test(contactNumber)) {
      invalid.add("contactNumber");
    }

    const fromDate = data.from ? new Date(`${data.from}T00:00:00`) : null;
    const toDate = data.to ? new Date(`${data.to}T00:00:00`) : null;
    if (
      fromDate &&
      toDate &&
      !Number.isNaN(fromDate.getTime()) &&
      !Number.isNaN(toDate.getTime()) &&
      toDate < fromDate
    ) {
      invalid.add("from");
      invalid.add("to");
    }

    if (!computedLeaveDays) {
      invalid.add("from");
      invalid.add("to");
      invalid.add("fromSession");
      invalid.add("toSession");
      invalid.add("days");
    }

    const toMarker =
      (toDate?.getTime() ?? 0) / 86400000 + SESSION_OFFSET[toSession];
    const today = new Date();
    const todayDate = new Date(`${today.toISOString().slice(0, 10)}T00:00:00`);
    const nowMarker =
      todayDate.getTime() / 86400000 + SESSION_OFFSET[resolveCurrentSession()];
    if (toDate && toMarker <= nowMarker) {
      invalid.add("to");
      invalid.add("toSession");
    }

    const flaggedFields = new Set([...missing, ...invalid]);
    markMissingInputs(form, flaggedFields);

    if (flaggedFields.size > 0) {
      setMissingFields(Array.from(flaggedFields));
      if (invalid.has("days")) {
        setSubmitError(
          "No. of days is auto-calculated from date/session and must be greater than 0.",
        );
      } else if (invalid.has("contactNumber")) {
        setSubmitError("Phone number must contain exactly 10 digits.");
      } else if (invalid.has("toSession")) {
        setSubmitError(
          "End date/session must be after the current date session and after start date/session.",
        );
      } else if (invalid.has("from") || invalid.has("to")) {
        setSubmitError(
          "The To date must be the same as or later than the From date.",
        );
      }
      return;
    }

    const signatureError = signature.ensureReadyForSubmit({
      typed: "Please type your signature before submitting.",
      digital:
        "Please complete Digital Signature and OTP verification on the form before submitting.",
    });
    if (signatureError) {
      setSubmitError(signatureError);
      return;
    }

    setMissingFields([]);
    setSubmitError(null);
    pendingDataRef.current = data;
    setDialogState("confirm");
  };

  const handleConfirmSubmit = async () => {
    const signatureError = signature.ensureReadyForSubmit({
      typed: "Please type your signature before submitting.",
      digital:
        "Complete digital signature and OTP verification before submitting.",
    });
    if (signatureError) {
      setSubmitError(signatureError);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/station-leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          form: pendingDataRef.current,
          signature:
            signature.signatureMode === "digital"
              ? signature.signatureCapture
              : undefined,
          otpVerified: signature.signatureMode === "digital",
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          referenceCode?: string;
          approverName?: string;
          approverRole?: string;
        };
      };

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "Unable to submit station leave form.",
        );
      }

      const refCode = result.data?.referenceCode;
      const routeNote =
        result.data?.approverName && result.data?.approverRole
          ? ` Routed to ${result.data.approverName} (${result.data.approverRole}).`
          : "";

      setSubmitMessage(
        `${result.message ?? "Station leave submitted successfully."}${refCode ? ` Reference: ${refCode}.` : ""}${routeNote}`,
      );
      setConfirmed(true);
      setDialogState("success");
      signature.resetAfterSubmit({ clearSignature: false });
      await loadBootstrap();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit station leave form.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogState(null);
    signature.setOtpCode("");
  };

  const handleDownloadPdf = async () => {
    const printable = printableRef.current;
    if (!printable) return;
    setIsDownloading(true);
    try {
      await downloadFormAsPdf(printable, "Station Leave", {
        sanitizeFormFields: true,
      });
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const loadBootstrap = async () => {
    const form = formRef.current;

    try {
      const response = await fetch("/api/station-leave/bootstrap", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          defaults?: Record<string, string>;
          history?: StationLeaveHistoryItem[];
        };
      };

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "Unable to load station leave profile data.",
        );
      }

      const defaults = result.data?.defaults ?? {};
      if (form) {
        Object.entries(defaults).forEach(([key, value]) => {
          if (!value) return;
          const field = form.querySelector<
            HTMLInputElement | HTMLSelectElement
          >(`[name="${key}"]`);
          if (field && !field.value.trim()) {
            field.value = value;
          }
        });

        const loadedFrom =
          form.querySelector<HTMLInputElement>("input[name='from']")?.value ??
          "";
        const loadedTo =
          form.querySelector<HTMLInputElement>("input[name='to']")?.value ?? "";
        const loadedFromSession =
          (form.querySelector<HTMLSelectElement>("select[name='fromSession']")
            ?.value as DaySession | undefined) ?? "MORNING";
        const loadedToSession =
          (form.querySelector<HTMLSelectElement>("select[name='toSession']")
            ?.value as DaySession | undefined) ?? "EVENING";

        setFromDate(loadedFrom);
        setToDate(loadedTo);
        setFromSession(loadedFromSession);
        setToSession(loadedToSession);
      }

      setHistory(result.data?.history ?? []);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to load station leave profile data.",
      );
    }
  };

  useEffect(() => {
    const form = formRef.current;
    if (form) {
      void applyAutofillToForm(form, "station-leave").then((profile) => {
        setOtpEmail(profile.email ?? "");
      });
    }

    void loadBootstrap();
  }, [setOtpEmail]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const department =
      form.querySelector<HTMLInputElement>("input[name='department']")?.value ??
      "";

    const roleKeyRaw =
      typeof window !== "undefined"
        ? window.localStorage.getItem("lf-user-role")
        : null;

    if (roleKeyRaw === ROLE_KEYS.STAFF) {
      setWorkflowMessage(
        "On submit, your station leave goes to Registrar for approval. If duration exceeds 30 days, it additionally routes to Director.",
      );
      return;
    }

    if (roleKeyRaw === ROLE_KEYS.FACULTY) {
      setWorkflowMessage(
        `On submit, your station leave goes to HoD (${department || "same department"}) for approval. If duration exceeds 30 days, it additionally routes to Director.`,
      );
      return;
    }

    if (roleKeyRaw === ROLE_KEYS.HOD) {
      setWorkflowMessage(
        "On submit, your station leave goes to Dean for approval. If duration exceeds 30 days, it additionally routes to Director.",
      );
      return;
    }

    if (roleKeyRaw === ROLE_KEYS.DEAN || roleKeyRaw === ROLE_KEYS.REGISTRAR) {
      setIsRoleLocked(true);
      setWorkflowMessage(
        "Station leave form is locked for Dean and Registrar.",
      );
      setSubmitError("Station leave form is locked for Dean and Registrar.");
      return;
    }

    setIsRoleLocked(false);
    setSubmitError(null);
  }, [history.length]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="px-0 text-sm font-semibold text-slate-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div ref={printableRef}>
            <SurfaceCard className="mx-auto max-w-3xl space-y-5 border border-slate-300 bg-white p-6 md:p-7">
              <header className="space-y-1 text-center text-slate-900">
                <div className="flex items-start justify-center gap-4">
                  {/* html2canvas captures plain img more reliably for PDF export than next/image wrappers */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/iit_ropar.png"
                    alt="IIT Ropar"
                    width={64}
                    height={64}
                    loading="eager"
                    decoding="async"
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
                      नंगल रोड,रूपनगर,पंजाब-140001/ Nangal Road, Rupnagar,
                      Punjab-140001
                    </p>
                    <p className="text-[11px] text-slate-700">
                      दूरभाष/Tele: +91-1881-227078,फैक्स /Fax : +91-1881-223395
                    </p>
                  </div>
                </div>
                <div className="border-b border-slate-500" />
                <p className="text-base font-semibold underline">
                  STATION LEAVE PERMISSION (SLP)
                </p>
              </header>

              <div className="space-y-3 text-[13px] text-slate-900">
                <LineItem number="1." label="Name" inputId="name" />
                <LineItem
                  number="2."
                  label="Designation"
                  inputId="designation"
                />
                <LineItem number="3." label="Department" inputId="department" />
                <StationLeaveDatesRow
                  fromDate={fromDate}
                  toDate={toDate}
                  fromSession={fromSession}
                  toSession={toSession}
                  computedLeaveDays={computedLeaveDays}
                  onFromDateChange={setFromDate}
                  onToDateChange={setToDate}
                  onFromSessionChange={setFromSession}
                  onToSessionChange={setToSession}
                />
                <LineItem
                  number="5."
                  label="Nature of Leave sanctioned (if applicable)"
                  inputId="nature"
                />
                <LineItem
                  number="6."
                  label="Purpose of the Station Leave Permission"
                  inputId="purpose"
                />
                <StationLeaveContactRow />
              </div>

              <div className="space-y-2 text-[13px] text-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Place:</span>
                  <UnderlineInput id="place" width="w-44" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>Date:</span>
                  <UnderlineInput id="date" width="w-44" />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 text-right">
                  <span className="text-[12px] text-slate-800">
                    (Signature of the applicant)
                  </span>
                  <input
                    type="hidden"
                    id="applicantSign"
                    name="applicantSign"
                    value={
                      signature.signatureMode === "typed"
                        ? signature.typedSignature
                        : DIGITAL_SIGNATURE_VALUE
                    }
                    readOnly
                  />
                  <div className="relative flex h-10 w-64 items-end border-b border-dashed border-slate-500 px-1 pb-0.5 text-left text-[13px] text-slate-900">
                    {signature.signatureMode === "typed" ? (
                      <span className="truncate">
                        {signature.typedSignature}
                      </span>
                    ) : signature.signatureCapture?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={signature.signatureCapture.image}
                        alt="Applicant signature"
                        className="h-9 w-full object-contain object-left"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </SurfaceCard>
          </div>

          <SurfaceCard className="space-y-2 border-slate-200/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Routing</p>
            <p className="text-sm text-slate-600">{workflowMessage}</p>
          </SurfaceCard>

          {history.length > 0 ? (
            <SurfaceCard className="space-y-3 border-slate-200/80 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Recent station leave history
              </p>
              <div className="space-y-2">
                {history.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200/80 px-3 py-2 text-xs text-slate-700"
                  >
                    <p className="font-semibold text-slate-900">
                      {item.referenceCode}
                    </p>
                    <p>
                      {new Date(item.from).toLocaleDateString("en-GB")} to{" "}
                      {new Date(item.to).toLocaleDateString("en-GB")} (
                      {item.totalDays} days)
                    </p>
                    <p>
                      Status: {item.status} | Approver: {item.approver}
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          ) : null}

          <SignatureOtpVerificationCard
            signatureMode={signature.signatureMode}
            onSignatureModeChange={signature.onSignatureModeChange}
            typedSignature={signature.typedSignature}
            onTypedSignatureChange={signature.onTypedSignatureChange}
            otpEmail={signature.otpEmail}
            otpCode={signature.otpCode}
            onOtpCodeChange={signature.setOtpCode}
            otpStatusMessage={signature.otpStatusMessage}
            isSendingOtp={signature.isSendingOtp}
            isVerifyingOtp={signature.isVerifyingOtp}
            isSubmitting={isSubmitting}
            onSendOtp={signature.handleSendOtp}
            onVerifyOtp={signature.handleVerifyOtp}
            onSignatureChange={signature.onSignatureChange}
            isOtpVerified={signature.isOtpVerified}
          />

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-600">
              {submitError
                ? submitError
                : submitMessage
                  ? submitMessage
                  : confirmed
                    ? "Submission confirmed. You can still edit and resubmit if needed."
                    : missingFields.length > 0
                      ? "Please fill the highlighted fields."
                      : "Fill all fields, then submit."}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                className="px-4 text-sm"
                disabled={isRoleLocked}
              >
                {isRoleLocked ? "Locked" : "Submit"}
              </Button>
            </div>
          </div>
        </form>

        <ConfirmationModal
          state={dialogState}
          title="Station Leave"
          onCancel={handleCloseDialog}
          onConfirm={handleConfirmSubmit}
          onDownload={handleDownloadPdf}
          isDownloading={isDownloading}
          isSubmitting={isSubmitting}
        />
      </div>
    </DashboardShell>
  );
}

const ConfirmationModal = ({
  state,
  title,
  onCancel,
  onConfirm,
  onDownload,
  isDownloading,
  isSubmitting,
}: {
  state: DialogState;
  title: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  onDownload: () => void;
  isDownloading: boolean;
  isSubmitting: boolean;
}) => {
  if (!state) return null;
  const isSuccess = state === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">
            {isSuccess ? "Submission successful" : "Confirm submission"}
          </p>
          <p className="text-xs text-slate-600">
            {isSuccess
              ? `${title} request has been submitted successfully. You may close this window.`
              : `You are about to submit the ${title} request. Please review and confirm before continuing.`}
          </p>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm text-slate-800">
          {isSuccess ? (
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
              <li>Submission received and recorded.</li>
              <li>You may keep a copy for your records.</li>
            </ul>
          ) : (
            <div className="space-y-4">
              <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
                <li>I confirm the information provided is accurate.</li>
                <li>I acknowledge the submission will be routed for review.</li>
                <li>I understand I may be contacted for clarifications.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {isSuccess ? (
            <>
              <Button
                type="button"
                onClick={onDownload}
                className="px-4 text-sm"
                disabled={isDownloading}
              >
                {isDownloading ? "Preparing..." : "Download PDF"}
              </Button>
              <Button type="button" onClick={onCancel} className="px-4 text-sm">
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={onCancel}
                className="px-3 text-sm"
                type="button"
              >
                Go back
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                className="px-4 text-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Yes, submit"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const LineItem = ({
  number,
  label,
  inputId,
  suffix,
  suffixId,
  secondLine,
  secondId,
  thirdLabel,
  thirdId,
}: {
  number: string;
  label: string;
  inputId: string;
  suffix?: string;
  suffixId?: string;
  secondLine?: string;
  secondId?: string;
  thirdLabel?: string;
  thirdId?: string;
}) => (
  <div className="space-y-1">
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-6">{number}</span>
      <span className="flex-1">{label}</span>
      <span>:</span>
      <UnderlineInput id={inputId} className="flex-1" />
      {suffix ? (
        <>
          <span>{suffix}</span>
          <UnderlineInput id={suffixId ?? `${inputId}Suffix`} width="w-28" />
        </>
      ) : null}
    </div>
    {secondLine ? (
      <div className="flex flex-wrap items-center gap-2 pl-8">
        <span>{secondLine}</span>
        <UnderlineInput id={secondId ?? `${inputId}Second`} width="w-36" />
        {thirdLabel ? (
          <>
            <span>{thirdLabel}</span>
            <UnderlineInput id={thirdId ?? `${inputId}Third`} width="w-36" />
          </>
        ) : null}
      </div>
    ) : null}
  </div>
);

const StationLeaveDatesRow = ({
  fromDate,
  toDate,
  fromSession,
  toSession,
  computedLeaveDays,
  onFromDateChange,
  onToDateChange,
  onFromSessionChange,
  onToSessionChange,
}: {
  fromDate: string;
  toDate: string;
  fromSession: DaySession;
  toSession: DaySession;
  computedLeaveDays: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onFromSessionChange: (value: DaySession) => void;
  onToSessionChange: (value: DaySession) => void;
}) => (
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
        <DateUnderlineInput
          id="from"
          value={fromDate}
          min={getTodayIso()}
          onChange={(event) => onFromDateChange(event.target.value)}
        />
        <SessionSelect
          id="fromSession"
          value={fromSession}
          onChange={(event) =>
            onFromSessionChange(event.target.value as DaySession)
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <span>To</span>
        <DateUnderlineInput
          id="to"
          value={toDate}
          min={fromDate || getTodayIso()}
          onChange={(event) => onToDateChange(event.target.value)}
        />
        <SessionSelect
          id="toSession"
          value={toSession}
          onChange={(event) =>
            onToSessionChange(event.target.value as DaySession)
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <span>No. of days</span>
        <UnderlineInput
          id="days"
          type="text"
          width="w-14"
          value={computedLeaveDays}
          readOnly
          className="text-center"
        />
      </div>
    </div>
  </div>
);

const DateUnderlineInput = ({
  id,
  value,
  min,
  onChange,
}: {
  id: string;
  value: string;
  min?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) => (
  <UnderlineInput
    id={id}
    type="date"
    width="w-40"
    className="scheme-light"
    value={value}
    min={min}
    onChange={onChange}
  />
);

const SessionSelect = ({
  id,
  value,
  onChange,
}: {
  id: string;
  value: DaySession;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) => (
  <select
    id={id}
    name={id}
    value={value}
    onChange={onChange}
    className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
  >
    <option value="MORNING">Morning</option>
    <option value="AFTERNOON">Afternoon</option>
    <option value="EVENING">Evening</option>
  </select>
);

const StationLeaveContactRow = () => (
  <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-6">7.</span>
      <span className="flex-1">
        Contact number and address during station leave
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-3 pl-8">
      <select
        id="contactPrefix"
        name="contactPrefix"
        defaultValue="+91"
        className="rounded-full border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none"
      >
        {COUNTRY_CODE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <UnderlineInput
        id="contactNumber"
        type="tel"
        width="w-40"
        inputMode="numeric"
        pattern="[0-9]{10}"
        maxLength={10}
        placeholder="10-digit mobile"
        onInput={(event) => {
          const target = event.currentTarget;
          target.value = target.value.replace(/\D/g, "").slice(0, 10);
        }}
      />
    </div>
    <div className="flex flex-wrap items-center gap-2 pl-8">
      <span>Address</span>
      <UnderlineInput id="contactAddress" className="flex-1" />
    </div>
  </div>
);
