"use client";

export const dynamic = "force-dynamic";

import type { FormEvent, InputHTMLAttributes } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  SignatureOtpVerificationCard,
  type SignatureCapture,
  type SignatureMode,
} from "@/components/leaves/signature-otp-verification-card";
import { ProposedActingHodField } from "@/components/leaves/proposed-acting-hod-field";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  DIGITAL_SIGNATURE_VALUE,
  useSignatureOtp,
} from "@/components/leaves/use-signature-otp";
import {
  type DaySession,
  SESSION_OFFSET,
  computeSessionLeaveDaysFromInput,
  formatSessionDays,
  getTodayIso,
} from "@/lib/leave-session";
import {
  applyAutofillToForm,
  clearFormDraft,
  saveFormDraft,
} from "@/lib/form-autofill";
import { downloadFormAsPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;

type WorkflowPreview = {
  label: string;
  steps: Array<{ actor: string; label: string }>;
  note?: string;
};

const LTC_WORKFLOW_PREVIEWS: Array<WorkflowPreview & { key: string }> = [
  {
    key: "FACULTY",
    label: "Faculty",
    steps: [
      { actor: "HOD", label: "HoD / Associate HoD" },
      { actor: "ESTABLISHMENT", label: "Establishment" },
      { actor: "ACCOUNTS", label: "Accounts" },
      { actor: "DEAN", label: "Dean" },
    ],
    note: "The HoD step is chosen from your reporting chain or department mapping.",
  },
  {
    key: "STAFF",
    label: "Staff",
    steps: [
      { actor: "REGISTRAR", label: "Registrar" },
      { actor: "ESTABLISHMENT", label: "Establishment" },
      { actor: "ACCOUNTS", label: "Accounts" },
      { actor: "REGISTRAR", label: "Registrar (final)" },
    ],
  },
  {
    key: "HOD",
    label: "HoD",
    steps: [
      { actor: "DEAN", label: "Dean" },
      { actor: "ESTABLISHMENT", label: "Establishment" },
      { actor: "ACCOUNTS", label: "Accounts" },
      { actor: "DEAN", label: "Dean (final)" },
    ],
  },
];

const resolveApplicableWorkflowKey = (roleKey: string | null) => {
  if (!roleKey) return null;
  if (roleKey === "ASSOCIATE_HOD") return "HOD";
  if (roleKey === "FACULTY" || roleKey === "STAFF" || roleKey === "HOD") {
    return roleKey;
  }
  return null;
};

const UnderlineInput = ({
  id,
  width = "w-48",
  className,
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) =>
  // Treat readOnly/disabled fields as locked for role-gated sections.
  ((locked: boolean) => (
    <input
      id={id}
      name={id}
      type={props.type ?? "text"}
      className={cn(
        "border-0 border-b border-dashed border-slate-500 bg-transparent px-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none",
        locked && "cursor-not-allowed bg-slate-50 opacity-80",
        width,
        className,
      )}
      {...props}
    />
  ))(Boolean(props.readOnly || (props.disabled as boolean | undefined)));

const pages = ["LTC form", "Office sections"] as const;

export default function LtcPage() {
  return (
    <Suspense fallback={null}>
      <LtcPageContent />
    </Suspense>
  );
}

function LtcPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [viewerRoleKey, setViewerRoleKey] = useState<string | null>(null);
  const canSeeOfficeSections =
    viewerRoleKey === "ESTABLISHMENT" ||
    viewerRoleKey === "ACCOUNTS" ||
    viewerRoleKey === "REGISTRAR" ||
    viewerRoleKey === "DEAN" ||
    viewerRoleKey === "ADMIN";
  const activePages = useMemo(
    () => (canSeeOfficeSections ? pages : ([pages[0]] as const)),
    [canSeeOfficeSections],
  );
  const [page, setPage] = useState(0);
  const isLastPage = page === activePages.length - 1;
  const formRef = useRef<HTMLFormElement>(null);
  const pendingDataRef = useRef<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveFromSession, setLeaveFromSession] =
    useState<DaySession>("MORNING");
  const [leaveToSession, setLeaveToSession] = useState<DaySession>("EVENING");
  const [computedLeaveDays, setComputedLeaveDays] = useState("");
  const signature = useSignatureOtp({ enableTyped: true });
  const setOtpEmail = signature.setOtpEmail;

  const markMissingInputs = (form: HTMLFormElement, missing: Set<string>) => {
    const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input"));
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

  const handleBack = () => {
    if (page > 0) {
      setPage((p) => p - 1);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      const safeReturnTo =
        returnTo && returnTo.startsWith("/") ? returnTo : "/";
      router.push(safeReturnTo);
    }
  };

  const next = () => setPage((p) => Math.min(p + 1, activePages.length - 1));
  const prev = () => setPage((p) => Math.max(p - 1, 0));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConfirmed(false);
    const form = formRef.current;
    if (!form) return;
    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    data.leaveFromSession = leaveFromSession;
    data.leaveToSession = leaveToSession;
    data.leaveDays = computedLeaveDays;
    data.applicantSignature =
      signature.signatureMode === "typed"
        ? signature.typedSignature.trim()
        : DIGITAL_SIGNATURE_VALUE;
    saveFormDraft("ltc", data);
    const allInputKeys = Array.from(
      form.querySelectorAll<HTMLInputElement>("input"),
    )
      .map((input) => input.name || input.id)
      .filter(Boolean);

    const missing = allInputKeys.filter((key) => {
      // Make the "persons" table optional: only require non-person fields.
      if (key.startsWith("person")) return false;
      return !data[key]?.trim();
    });
    const missingSet = new Set(missing);
    markMissingInputs(form, missingSet);
    if (missingSet.size > 0) {
      setMissingFields(Array.from(missingSet));
      return;
    }

    if (!computedLeaveDays) {
      window.alert(
        "No. of leave days is auto-calculated from date/session and must be greater than 0.",
      );
      return;
    }

    const signatureError = signature.ensureReadyForSubmit({
      typed: "Please type your signature before submitting.",
      digital:
        "Please complete Digital Signature and OTP verification on the form before submitting.",
    });
    if (signatureError) {
      window.alert(signatureError);
      return;
    }

    setMissingFields([]);
    pendingDataRef.current = data;
    setDialogState("confirm");
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    void applyAutofillToForm(form, "ltc").then((profile) => {
      setViewerRoleKey(profile.roleKey ?? null);
      setOtpEmail(profile.email ?? "");
      setLeaveFrom(
        form.querySelector<HTMLInputElement>("#leaveFrom")?.value ?? "",
      );
      setLeaveTo(form.querySelector<HTMLInputElement>("#leaveTo")?.value ?? "");
      setLeaveFromSession(
        (form.querySelector<HTMLSelectElement>("#leaveFromSession")?.value as
          | DaySession
          | undefined) ?? "MORNING",
      );
      setLeaveToSession(
        (form.querySelector<HTMLSelectElement>("#leaveToSession")?.value as
          | DaySession
          | undefined) ?? "EVENING",
      );
    });
  }, [setOtpEmail]);

  useEffect(() => {
    setPage((current) => Math.min(current, activePages.length - 1));
  }, [activePages.length]);

  useEffect(() => {
    const value = computeSessionLeaveDaysFromInput(
      leaveFrom,
      leaveFromSession,
      leaveTo,
      leaveToSession,
    );
    setComputedLeaveDays(value ? formatSessionDays(value) : "");
  }, [leaveFrom, leaveFromSession, leaveTo, leaveToSession]);

  useEffect(() => {
    if (!leaveFrom || !leaveTo) return;
    if (leaveTo < leaveFrom) {
      setLeaveTo(leaveFrom);
      setLeaveToSession("EVENING");
      return;
    }

    if (
      leaveTo === leaveFrom &&
      SESSION_OFFSET[leaveToSession] <= SESSION_OFFSET[leaveFromSession]
    ) {
      setLeaveToSession(
        leaveFromSession === "MORNING"
          ? "AFTERNOON"
          : leaveFromSession === "AFTERNOON"
            ? "EVENING"
            : "EVENING",
      );
    }
  }, [leaveFrom, leaveFromSession, leaveTo, leaveToSession]);

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

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    try {
      const response = await fetch("/api/ltc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: pendingDataRef.current,
          signature:
            signature.signatureMode !== "typed"
              ? signature.signatureCapture
              : undefined,
          otpVerified:
            signature.signatureMode !== "typed"
              ? signature.isOtpVerified
              : false,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Failed to submit LTC application.");
      }

      setConfirmed(true);
      setSubmitMessage(
        result.message || "LTC application submitted successfully.",
      );
      clearFormDraft("ltc");
      signature.resetAfterSubmit();
      setDialogState("success");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unable to submit LTC application.";
      setSubmitError(errorMessage);
      setDialogState(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogState(null);
    signature.setOtpCode("");
  };

  const handleDownloadPdf = async () => {
    const form = formRef.current;
    if (!form) return;
    setIsDownloading(true);
    try {
      await downloadFormAsPdf(form, "LTC");
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const pageLabel = useMemo(
    () => `${activePages[page]} (${page + 1}/${activePages.length})`,
    [activePages, page],
  );
  return (
    <DashboardShell>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="px-0 text-sm font-semibold text-slate-700"
            type="button"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {pageLabel}
          </span>
        </div>

        {page === 0 && (
          <LtcFormPage
            leaveFrom={leaveFrom}
            leaveTo={leaveTo}
            leaveFromSession={leaveFromSession}
            leaveToSession={leaveToSession}
            computedLeaveDays={computedLeaveDays}
            onLeaveFromChange={setLeaveFrom}
            onLeaveToChange={setLeaveTo}
            onLeaveFromSessionChange={setLeaveFromSession}
            onLeaveToSessionChange={setLeaveToSession}
            signatureMode={signature.signatureMode}
            typedSignature={signature.typedSignature}
            signatureCapture={signature.signatureCapture}
          />
        )}
        {page === 1 && canSeeOfficeSections && (
          <OfficeSectionsPage viewerRoleKey={viewerRoleKey} />
        )}

        <LtcWorkflowPreviewCard viewerRoleKey={viewerRoleKey} />

        <ProposedActingHodField />

        <SignatureOtpVerificationCard
          storageScope="ltc"
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

        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
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

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={prev}
            disabled={page === 0}
            className="px-3 text-sm"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Prev
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type={isLastPage ? "submit" : "button"}
              onClick={isLastPage ? undefined : next}
              className="px-4 text-sm"
              disabled={isSubmitting}
            >
              {isLastPage
                ? isSubmitting
                  ? "Submitting..."
                  : "Submit"
                : "Next"}
              {!isLastPage && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>

        <ConfirmationModal
          state={dialogState}
          title="LTC"
          onCancel={handleCloseDialog}
          onConfirm={handleConfirmSubmit}
          onDownload={handleDownloadPdf}
          isDownloading={isDownloading}
          isSubmitting={isSubmitting}
        />
      </form>
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
              ? `${title} form has been submitted successfully. You may close this window.`
              : `You are about to submit the ${title} form. Please review and confirm before continuing.`}
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
                disabled={isSubmitting}
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

const LtcFormPage = ({
  leaveFrom,
  leaveTo,
  leaveFromSession,
  leaveToSession,
  computedLeaveDays,
  onLeaveFromChange,
  onLeaveToChange,
  onLeaveFromSessionChange,
  onLeaveToSessionChange,
  signatureMode,
  typedSignature,
  signatureCapture,
}: {
  leaveFrom: string;
  leaveTo: string;
  leaveFromSession: DaySession;
  leaveToSession: DaySession;
  computedLeaveDays: string;
  onLeaveFromChange: (value: string) => void;
  onLeaveToChange: (value: string) => void;
  onLeaveFromSessionChange: (value: DaySession) => void;
  onLeaveToSessionChange: (value: DaySession) => void;
  signatureMode: SignatureMode;
  typedSignature: string;
  signatureCapture: SignatureCapture | null;
}) => (
  <SurfaceCard className="mx-auto max-w-5xl space-y-4 border border-slate-300 bg-white p-4 md:p-6">
    <header className="space-y-1 text-center text-slate-900">
      <div className="flex items-center justify-center gap-4">
        <Image
          src="/iit_ropar.png"
          alt="IIT Ropar"
          width={56}
          height={56}
          className="object-contain"
        />
        <div className="space-y-1">
          <p className="text-base font-semibold">
            भारतीय प्रौद्योगिकी संस्थान रोपड़
          </p>
          <p className="text-base font-semibold uppercase">
            INDIAN INSTITUTE OF TECHNOLOGY ROPAR
          </p>
          <p className="text-[11px] text-slate-700">
            रूपनगर, पंजाब-140001 / Rupnagar, Punjab-140001
          </p>
        </div>
      </div>
      <p className="text-[12px] font-semibold">
        APPLICATION FOR LEAVE TRAVEL CONCESSION
      </p>
    </header>

    <div className="overflow-x-auto">
      <table className="w-full border border-slate-400 text-[12px] text-slate-900">
        <tbody>
          <RowSimple
            number="1."
            label="Name of the Employee with Employee Code"
            inputId="employeeName"
          />
          <RowSimple
            number="2."
            label="Designation and Department"
            inputId="designation"
          />
          <RowSimple
            number="3."
            label="Date of entering the Central Government Service/Date of joining with IIT Ropar"
            inputId="dateOfJoining"
          />
          <RowSimple number="4." label="Pay Level" inputId="payLevel" />
          <RowLeaveRequired
            leaveFrom={leaveFrom}
            leaveTo={leaveTo}
            leaveFromSession={leaveFromSession}
            leaveToSession={leaveToSession}
            computedLeaveDays={computedLeaveDays}
            onLeaveFromChange={onLeaveFromChange}
            onLeaveToChange={onLeaveToChange}
            onLeaveFromSessionChange={onLeaveFromSessionChange}
            onLeaveToSessionChange={onLeaveToSessionChange}
          />
          <RowSimple
            number="6."
            label="Whether spouse is employed, if yes whether entitled to LTC"
            inputId="spouseLtc"
          />
          <RowProposedDates />
          <RowSimple
            number="8."
            label="Home Town as recorded in the Service Book"
            inputId="homeTown"
          />
          <RowSimple
            number="9."
            label="Nature of LTC to be availed:- Home Town/ Anywhere in India"
            inputId="ltcNature"
          />
          <RowSimple
            number="10."
            label="Place to be visited"
            inputId="placeToVisit"
          />
          <RowSimple
            number="11."
            label="Total Estimated fare of entitled class for to and fro journey (proof need to be attached)."
            inputId="estimatedFare"
          />
          <RowPersons />
          <RowAdvance />
          <RowEncashment />
        </tbody>
      </table>
    </div>

    <ImportantNote />
    <Undertaking
      signatureMode={signatureMode}
      typedSignature={typedSignature}
      signatureCapture={signatureCapture}
    />
  </SurfaceCard>
);

const OfficeSectionsPage = ({
  viewerRoleKey,
}: {
  viewerRoleKey: string | null;
}) => (
  <SurfaceCard className="mx-auto max-w-5xl space-y-6 border border-slate-300 bg-white p-4 md:p-6">
    <EstablishmentSection viewerRoleKey={viewerRoleKey} />
    <AccountsSection viewerRoleKey={viewerRoleKey} />
    <AuditSection viewerRoleKey={viewerRoleKey} />
  </SurfaceCard>
);

const LtcWorkflowPreviewCard = ({
  viewerRoleKey,
}: {
  viewerRoleKey: string | null;
}) => {
  const applicableKey = resolveApplicableWorkflowKey(viewerRoleKey);
  const applicable = applicableKey
    ? (LTC_WORKFLOW_PREVIEWS.find((entry) => entry.key === applicableKey) ??
      null)
    : null;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approval workflow
          </p>
          <p className="mt-1 text-xs text-slate-600">
            This is the complete routing for LTC applications.
          </p>
        </div>
        {applicable?.steps?.[0] ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            Your route: {applicable.label} | Next: {applicable.steps[0].label}
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        {applicable ? (
          <div
            className={cn(
              "rounded-xl border border-slate-200 bg-white p-4 ring-2 ring-slate-300",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {applicable.label}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                Your route
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {applicable.steps.map((step, index) => (
                <div key={`${applicable.key}-${step.actor}-${index}`}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {step.label}
                    </span>
                  </div>
                  {index < applicable.steps.length - 1 ? (
                    <div className="ml-3.5 mt-1 h-3 border-l border-dashed border-slate-300" />
                  ) : null}
                </div>
              ))}
            </div>

            {applicable.note ? (
              <p className="mt-3 text-xs text-slate-500">{applicable.note}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Your role does not submit LTC applications, but office roles may
            still view and process them.
          </p>
        )}
      </div>
    </div>
  );
};

const RowSimple = ({
  number,
  label,
  inputId,
}: {
  number: string;
  label: string;
  inputId: string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
      {number}
    </td>
    <td className="px-3 py-2 align-top">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{label}</span>
        <UnderlineInput id={inputId} className="flex-1" />
      </div>
    </td>
  </tr>
);

const RowLeaveRequired = ({
  leaveFrom,
  leaveTo,
  leaveFromSession,
  leaveToSession,
  computedLeaveDays,
  onLeaveFromChange,
  onLeaveToChange,
  onLeaveFromSessionChange,
  onLeaveToSessionChange,
}: {
  leaveFrom: string;
  leaveTo: string;
  leaveFromSession: DaySession;
  leaveToSession: DaySession;
  computedLeaveDays: string;
  onLeaveFromChange: (value: string) => void;
  onLeaveToChange: (value: string) => void;
  onLeaveFromSessionChange: (value: DaySession) => void;
  onLeaveToSessionChange: (value: DaySession) => void;
}) => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">5.</td>
    <td className="px-3 py-2">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Leave required</span>
          <span>Nature:</span>
          <UnderlineInput id="leaveNature" width="w-32" />
          <span>From</span>
          <UnderlineInput
            id="leaveFrom"
            type="date"
            width="w-32"
            min={getTodayIso()}
            value={leaveFrom}
            onChange={(event) => onLeaveFromChange(event.target.value)}
          />
          <SessionSelect
            id="leaveFromSession"
            value={leaveFromSession}
            onChange={onLeaveFromSessionChange}
          />
          <span>To</span>
          <UnderlineInput
            id="leaveTo"
            type="date"
            width="w-32"
            min={leaveFrom || getTodayIso()}
            value={leaveTo}
            onChange={(event) => onLeaveToChange(event.target.value)}
          />
          <SessionSelect
            id="leaveToSession"
            value={leaveToSession}
            onChange={onLeaveToSessionChange}
          />
          <span>No. of days</span>
          <UnderlineInput
            id="leaveDays"
            width="w-20"
            readOnly
            value={computedLeaveDays}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span>Prefix: From</span>
          <UnderlineInput id="prefixFrom" type="date" width="w-32" />
          <span>To</span>
          <UnderlineInput id="prefixTo" type="date" width="w-32" />
          <span>&amp; Suffix: From</span>
          <UnderlineInput id="suffixFrom" type="date" width="w-32" />
          <span>To</span>
          <UnderlineInput id="suffixTo" type="date" width="w-32" />
        </div>
      </div>
    </td>
  </tr>
);

const SessionSelect = ({
  id,
  value,
  onChange,
}: {
  id: string;
  value: DaySession;
  onChange: (value: DaySession) => void;
}) => (
  <select
    id={id}
    name={id}
    value={value}
    onChange={(event) => onChange(event.target.value as DaySession)}
    className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
  >
    <option value="MORNING">Morning</option>
    <option value="AFTERNOON">Afternoon</option>
    <option value="EVENING">Evening</option>
  </select>
);

const RowProposedDates = () => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">7.</td>
    <td className="px-3 py-2">
      <div className="font-semibold">Proposed dates of Journey</div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border border-slate-400 text-[12px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-400 px-2 py-1 text-left">
                &nbsp;
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Date of Outward journey
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Date of Inward journey
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                Self
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="selfOutward"
                  type="date"
                  className="w-full"
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="selfInward"
                  type="date"
                  className="w-full"
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                Family
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="familyOutward"
                  type="date"
                  className="w-full"
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="familyInward"
                  type="date"
                  className="w-full"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </td>
  </tr>
);

const RowPersons = () => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">12.</td>
    <td className="px-3 py-2">
      <div className="font-semibold">
        Person(s) in respect of whom LTC is proposed to be availed.
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
            {["i", "ii", "iii", "iv", "v"].map((rowKey, idx) => (
              <tr key={rowKey}>
                <td className="border border-slate-400 px-2 py-1 font-semibold">
                  ({rowKey})
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Name`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Age`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Relation`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}From`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}To`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Back`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Mode`}
                    className="w-full"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </td>
  </tr>
);

const RowAdvance = () => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">13.</td>
    <td className="px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Advance Required</span>
        <select
          id="advanceRequired"
          name="advanceRequired"
          className="w-32 rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
        >
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
    </td>
  </tr>
);

const RowEncashment = () => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">14.</td>
    <td className="px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="font-semibold">
          Encashment of earned leave required.
        </span>
        <select
          id="encashmentRequired"
          name="encashmentRequired"
          className="w-32 rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
        >
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
        <UnderlineInput id="encashmentDays" width="w-20" />
        <span>days</span>
      </div>
    </td>
  </tr>
);

const ImportantNote = () => (
  <div className="space-y-2 text-[11px] leading-relaxed text-slate-900">
    <p className="font-semibold">Important Note for Air Travel :-</p>
    <ol className="space-y-2 pl-4">
      <li>
        (i) Government employees are to choose flight having the Best Available
        Fare on their entitled travel class which is the Cheapest Fare
        available, preferably for Non-stop flight in a 3 hours slot.
      </li>
      <li>
        (ii) At the time of booking, they are to retain the print-out of the
        concerned webpage of the ATAs having flight and fare details for the
        purpose of the settlement of the LTC claims.
      </li>
      <li>
        (iii) Air tickets shall be purchased only from the three Authorized
        Travel Agents (ATAs) only.
      </li>
    </ol>
  </div>
);

const Undertaking = ({
  signatureMode,
  typedSignature,
  signatureCapture,
}: {
  signatureMode: SignatureMode;
  typedSignature: string;
  signatureCapture: SignatureCapture | null;
}) => (
  <div className="space-y-3 text-[12px] text-slate-900">
    <p className="font-semibold">I undertake:-</p>
    <ol className="space-y-1 pl-5">
      <li>
        (a) To produce the tickets for the journey within 10 days of receipt of
        the advance.
      </li>
      <li>
        (b) To refund the entire advance in lump sum, in the event of
        cancellation of the journey within two months from the date of drawal of
        the advance or failure to produce the tickets within 10 days of drawl of
        the advance.
      </li>
      <li>
        (c) To travel by Air/Rail/Road as per my entitlement and as per GOI LTC
        rules or specific rules as adopted by the Institute
      </li>
      <li>
        (d) I will communicate to the competent authority about any change of
        declared place of visit or change of dates before the commencement of
        the journey.
      </li>
    </ol>
    <p className="font-semibold">Certified that:-</p>
    <ol className="space-y-1 pl-5">
      <li>
        (1) The information, as given above is true to the best of my knowledge
        and belief; and
      </li>
      <li>
        (2) My spouse is not employed in Government service / my spouse is
        employed in government service and the concession has not been availed
        of by him/her separately of himself/herself or for any of the family
        members for the <UnderlineInput id="blockYear" width="w-32" /> block
        year.
      </li>
    </ol>
    <div className="flex flex-wrap items-center justify-between pt-2 text-[12px]">
      <div className="font-semibold">Forwarded please.</div>
      <div className="flex items-center gap-2">
        <span>Signature of the Applicant with date</span>
        <input
          type="hidden"
          id="applicantSignature"
          name="applicantSignature"
          value={
            signatureMode === "typed" ? typedSignature : DIGITAL_SIGNATURE_VALUE
          }
          readOnly
        />
        <span className="inline-flex h-9 w-56 items-end border-b border-dashed border-slate-500 px-1 pb-0.5 align-middle text-left text-[13px] text-slate-900">
          {signatureMode === "typed" ? (
            typedSignature
          ) : signatureCapture ? (
            <Image
              src={signatureCapture.image}
              alt="Applicant signature"
              width={224}
              height={36}
              unoptimized
              className="h-8 w-full object-contain"
            />
          ) : (
            DIGITAL_SIGNATURE_VALUE
          )}
        </span>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between text-[12px]">
      <span>Head/Section Incharge</span>
      <span className="mr-20">&nbsp;</span>
    </div>
  </div>
);

const EstablishmentSection = ({
  viewerRoleKey,
}: {
  viewerRoleKey: string | null;
}) => {
  const locked = !(
    viewerRoleKey === "ESTABLISHMENT" || viewerRoleKey === "ADMIN"
  );

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      <div className="text-center font-semibold">
        (A) FOR USE OF ESTABLISHMENT SECTION
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Fresh Recruit i.e. joining Govt. Service after 01.09.2008 /otherwise,
          Date of joining:
        </span>
        <UnderlineInput id="freshRecruitDate" width="w-40" readOnly={locked} />
        <span>Block year:</span>
        <UnderlineInput id="estBlockYear" width="w-28" readOnly={locked} />
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
                Nature of LTC (Home Town/Anywhere in India-place visited/to be
                visited)
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estNatureLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estNatureCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                02
              </td>
              <td className="border border-slate-400 px-2 py-1">
                Period (from _______ to _______)
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estPeriodLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estPeriodCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                03
              </td>
              <td className="border border-slate-400 px-2 py-1">
                LTC for Self/Family
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estSelfFamilyLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estSelfFamilyCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                04
              </td>
              <td className="border border-slate-400 px-2 py-1">
                Earned leave encashment (No. of Days)
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estEncashLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estEncashCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                05
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <div className="space-y-1">
                  <div>Earned Leave standing to his credit on ________ =</div>
                  <div>Balance Earned leave after this encashment =</div>
                  <div>Earned Leave encashment admissible =</div>
                </div>
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estLeaveLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estLeaveCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                06
              </td>
              <td className="border border-slate-400 px-2 py-1">
                Period and nature of leave applied for and need to be sanctioned
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estPeriodNatureLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estPeriodNatureCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px]">
        May consider and approve the above LTC (Home Town/Anywhere in India),
        Leave and Encashment of Leave.
      </p>
      <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
        <span>Junior Assistant</span>
        <span>Junior Superintendent/Superintendent</span>
        <span>AR/DR</span>
      </div>
    </div>
  );
};

const AccountsSection = ({
  viewerRoleKey,
}: {
  viewerRoleKey: string | null;
}) => {
  const locked = !(viewerRoleKey === "ACCOUNTS" || viewerRoleKey === "ADMIN");

  return (
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
                  <UnderlineInput
                    id={`accountsFrom${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsTo${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsMode${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsFares${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsSingleFare${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsAmount${row}`}
                    className="w-full"
                    readOnly={locked}
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
          <UnderlineInput id="accountsTotal" width="w-40" readOnly={locked} />
        </p>
        <p>
          Advance admissible (90% of above) = Rs.{" "}
          <UnderlineInput
            id="accountsAdmissible"
            width="w-32"
            readOnly={locked}
          />{" "}
          Passed for Rs.{" "}
          <UnderlineInput id="accountsPassed" width="w-32" readOnly={locked} />
        </p>
        <p>
          (in words); Rupees{" "}
          <UnderlineInput id="accountsInWords" width="w-64" readOnly={locked} />
        </p>
        <p>
          Debitable to LTC advance Dr./Mr./Mrs./Ms{" "}
          <UnderlineInput
            id="accountsDebitable"
            width="w-64"
            readOnly={locked}
          />
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
        <span>JAA/SAA</span>
        <span>JAO/AO</span>
        <span>AR/DR</span>
      </div>
    </div>
  );
};

const AuditSection = ({ viewerRoleKey }: { viewerRoleKey: string | null }) => {
  const registrarLocked = !(
    viewerRoleKey === "REGISTRAR" || viewerRoleKey === "ADMIN"
  );
  const deanLocked = !(viewerRoleKey === "DEAN" || viewerRoleKey === "ADMIN");

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      <div className="text-center font-semibold">
        (C) For use by the Audit Section
      </div>
      <div className="border border-slate-400 p-3 text-[11px]">
        <p>Comments/Observations:</p>
        <UnderlineInput
          id="auditComments"
          className="mt-2 w-full"
          readOnly={registrarLocked}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
        <span>Dealing Assistant</span>
        <span>JAO/AO</span>
        <span>Sr. Audit Officer</span>
      </div>
      <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
        <div className="flex items-center gap-2">
          <span>Recommended & Forwarded</span>
          <UnderlineInput
            id="auditRecommended"
            width="w-40"
            readOnly={registrarLocked}
          />
          <span>Registrar</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Approved/Not Approved</span>
          <UnderlineInput
            id="auditApproved"
            width="w-40"
            readOnly={deanLocked}
          />
          <span>Dean (F&A)</span>
        </div>
      </div>
    </div>
  );
};
