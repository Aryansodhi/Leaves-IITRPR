"use client";

export const dynamic = "force-dynamic";

import type { ChangeEvent, FormEvent, InputHTMLAttributes } from "react";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SignatureOtpVerificationCard } from "../../components/leaves/signature-otp-verification-card";
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
  resolveCurrentSession,
} from "@/lib/leave-session";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  applyAutofillToForm,
  clearFormDraft,
  saveFormDraft,
} from "@/lib/form-autofill";
import { downloadFormAsPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;

const calculateInclusiveDays = (fromValue?: string, toValue?: string) => {
  if (!fromValue || !toValue) return "";

  const from = new Date(`${fromValue}T00:00:00`);
  const to = new Date(`${toValue}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return "";
  }

  const difference = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  return `${difference}`;
};

const UnderlineInput = ({
  id,
  width = "w-48",
  className,
  readOnly,
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
  readOnly?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <input
    id={id}
    name={id}
    type="text"
    readOnly={readOnly}
    className={cn(
      "border-0 border-b border-dashed border-slate-400 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none",
      readOnly && "cursor-not-allowed opacity-75 bg-slate-50",
      width,
      className,
    )}
    {...props}
  />
);

const DateUnderlineInput = ({
  id,
  width = "w-32",
  className,
  readOnly,
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
  readOnly?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <input
    id={id}
    name={id}
    type="date"
    readOnly={readOnly}
    className={cn(
      "border-0 border-b border-dashed border-slate-400 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none scheme-light",
      readOnly && "cursor-not-allowed opacity-75",
      width,
      className,
    )}
    {...props}
  />
);

export default function EarnedLeavePage() {
  return (
    <Suspense fallback={null}>
      <EarnedLeavePageContent />
    </Suspense>
  );
}

function EarnedLeavePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const formRef = useRef<HTMLFormElement>(null);
  const pendingDataRef = useRef<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [stationLeaveRequired, setStationLeaveRequired] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [ltcChoice, setLtcChoice] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fromSession, setFromSession] = useState<DaySession>("MORNING");
  const [toSession, setToSession] = useState<DaySession>("EVENING");
  const [computedLeaveDays, setComputedLeaveDays] = useState("");
  const {
    otpEmail,
    setOtpEmail,
    otpCode,
    setOtpCode,
    otpStatusMessage,
    isSendingOtp,
    isVerifyingOtp,
    isOtpVerified,
    signatureMode,
    typedSignature,
    signatureCapture,
    onSignatureModeChange,
    onTypedSignatureChange,
    onSignatureChange,
    ensureReadyForSubmit,
    handleSendOtp,
    handleVerifyOtp,
    resetAfterSubmit,
  } = useSignatureOtp({ enableTyped: true });

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
    setConfirmed(false);
    const form = formRef.current;
    if (!form) return;

    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    data.fromSession = fromSession;
    data.toSession = toSession;
    data.days = computedLeaveDays;
    data.applicantSignature =
      signatureMode === "typed"
        ? typedSignature.trim()
        : DIGITAL_SIGNATURE_VALUE;
    saveFormDraft("earned-leave", data);

    // Exclude row 6 (prefix/suffix) fields from required validation
    const optionalFields = new Set([
      "prefixFromDate",
      "prefixToDate",
      "prefixDays",
      "suffixFromDate",
      "suffixToDate",
      "suffixDays",
      "applicantSignature",
    ]);

    // Exclude station leave dates if "No" is selected
    if (data.stationYesNo === "No") {
      optionalFields.add("stationFrom");
      optionalFields.add("stationTo");
    }

    // Exclude administrative fields (read-only, filled by admin staff)
    const adminFields = new Set([
      "recommended",
      "hodSignature",
      "adminFrom",
      "adminTo",
      "adminLeaveType",
      "balance",
      "adminDays",
      "assistant",
      "arDr",
      "registrar",
      "authoritySign",
    ]);

    const required = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input, select",
      ),
    )
      .map((input) => {
        const key = input.name || input.id;
        if (!key) return null;
        if (optionalFields.has(key)) return null;
        if (adminFields.has(key)) return null;
        if (input.type === "hidden" || input.type === "radio") return null;
        if ("readOnly" in input && input.readOnly) return null;
        return key;
      })
      .filter((key): key is string => key !== null);
    const missing = required.filter((key) => !data[key]?.trim());
    const missingSet = new Set(missing);
    markMissingInputs(form, missingSet);
    if (missingSet.size > 0) {
      setMissingFields(Array.from(missingSet));
      return;
    }

    const invalidSet = new Set<string>();
    const contactNo = (data.contactNo ?? "").trim();
    const pin = (data.pin ?? "").trim();
    const ltc = (data.ltc ?? "").trim();

    if (!/^\d{10}$/.test(contactNo)) {
      invalidSet.add("contactNo");
    }
    if (!/^\d{6}$/.test(pin)) {
      invalidSet.add("pin");
    }
    if (!(ltc === "PROPOSE" || ltc === "NOT_PROPOSE")) {
      invalidSet.add("ltc");
    }

    if (!computedLeaveDays) {
      invalidSet.add("fromDate");
      invalidSet.add("toDate");
      invalidSet.add("fromSession");
      invalidSet.add("toSession");
      invalidSet.add("days");
    }

    const toDateParsed = toDate ? new Date(`${toDate}T00:00:00`) : null;
    const toMarker =
      (toDateParsed?.getTime() ?? 0) / 86400000 + SESSION_OFFSET[toSession];
    const today = new Date();
    const todayDate = new Date(`${today.toISOString().slice(0, 10)}T00:00:00`);
    const nowMarker =
      todayDate.getTime() / 86400000 + SESSION_OFFSET[resolveCurrentSession()];
    if (toDate && toMarker <= nowMarker) {
      invalidSet.add("toDate");
      invalidSet.add("toSession");
    }

    if (invalidSet.size > 0) {
      markMissingInputs(form, invalidSet);
      setMissingFields(Array.from(invalidSet));
      setSubmitError(
        "Please select LTC option, enter a valid 10-digit contact number, and a valid 6-digit PIN.",
      );
      if (invalidSet.has("toSession")) {
        setSubmitError(
          "End date/session must be after the current date session and after start date/session.",
        );
      }
      return;
    }

    const signatureError = ensureReadyForSubmit({
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

  const handlePeriodDateChange = useCallback((field: "fromDate" | "toDate") => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      if (field === "fromDate") {
        setFromDate(event.target.value);
        return;
      }
      setToDate(event.target.value);
    };
  }, []);

  const handlePrefixDateChange = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const fromInput = form.querySelector<HTMLInputElement>("#prefixFromDate");
    const toInput = form.querySelector<HTMLInputElement>("#prefixToDate");
    const daysInput = form.querySelector<HTMLInputElement>("#prefixDays");

    if (fromInput && toInput && daysInput) {
      const days = calculateInclusiveDays(fromInput.value, toInput.value);
      daysInput.value = days;
    }
  }, []);

  const handleSuffixDateChange = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const fromInput = form.querySelector<HTMLInputElement>("#suffixFromDate");
    const toInput = form.querySelector<HTMLInputElement>("#suffixToDate");
    const daysInput = form.querySelector<HTMLInputElement>("#suffixDays");

    if (fromInput && toInput && daysInput) {
      const days = calculateInclusiveDays(fromInput.value, toInput.value);
      daysInput.value = days;
    }
  }, []);

  useEffect(() => {
    const value = computeSessionLeaveDaysFromInput(
      fromDate,
      fromSession,
      toDate,
      toSession,
    );
    setComputedLeaveDays(value ? formatSessionDays(value) : "");

    const form = formRef.current;
    const daysInput = form?.querySelector<HTMLInputElement>("#days");
    if (daysInput) {
      daysInput.value = value ? formatSessionDays(value) : "";
    }
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

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    // Set today's date for signature date field
    const signatureDateInput = form.querySelector<HTMLInputElement>(
      "#applicantSignatureDate",
    );
    if (signatureDateInput && !signatureDateInput.value) {
      signatureDateInput.value = new Date().toISOString().split("T")[0];
    }

    void applyAutofillToForm(form, "earned-leave").then((profile) => {
      setOtpEmail(profile.email ?? "");
      const fromValue =
        form.querySelector<HTMLInputElement>("#fromDate")?.value ?? "";
      const toValue =
        form.querySelector<HTMLInputElement>("#toDate")?.value ?? "";
      const fromSessionValue =
        (form.querySelector<HTMLSelectElement>("#fromSession")?.value as
          | DaySession
          | undefined) ?? "MORNING";
      const toSessionValue =
        (form.querySelector<HTMLSelectElement>("#toSession")?.value as
          | DaySession
          | undefined) ?? "EVENING";

      setFromDate(fromValue);
      setToDate(toValue);
      setFromSession(fromSessionValue);
      setToSession(toSessionValue);

      const ltcInput = form.querySelector<HTMLInputElement>("#ltc");
      if (!ltcInput) return;
      const rawValue = (ltcInput.value ?? "").trim().toLowerCase();
      if (rawValue === "not_propose" || rawValue.includes("not")) {
        setLtcChoice("NOT_PROPOSE");
        ltcInput.value = "NOT_PROPOSE";
        return;
      }
      if (rawValue === "propose" || rawValue.includes("propose")) {
        setLtcChoice("PROPOSE");
        ltcInput.value = "PROPOSE";
      }
    });

    // Set up date change listeners
    const prefixFromInput =
      form.querySelector<HTMLInputElement>("#prefixFromDate");
    const prefixToInput = form.querySelector<HTMLInputElement>("#prefixToDate");
    const suffixFromInput =
      form.querySelector<HTMLInputElement>("#suffixFromDate");
    const suffixToInput = form.querySelector<HTMLInputElement>("#suffixToDate");

    prefixFromInput?.addEventListener("change", handlePrefixDateChange);
    prefixToInput?.addEventListener("change", handlePrefixDateChange);
    suffixFromInput?.addEventListener("change", handleSuffixDateChange);
    suffixToInput?.addEventListener("change", handleSuffixDateChange);

    return () => {
      prefixFromInput?.removeEventListener("change", handlePrefixDateChange);
      prefixToInput?.removeEventListener("change", handlePrefixDateChange);
      suffixFromInput?.removeEventListener("change", handleSuffixDateChange);
      suffixToInput?.removeEventListener("change", handleSuffixDateChange);
    };
  }, [handlePrefixDateChange, handleSuffixDateChange, setOtpEmail]);

  const handleConfirmSubmit = async () => {
    const signatureError = ensureReadyForSubmit({
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
      const response = await fetch("/api/earned-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: pendingDataRef.current,
          signature: signatureMode === "digital" ? signatureCapture : undefined,
          otpVerified: signatureMode === "digital",
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(
          result.message || "Failed to submit earned leave application.",
        );
      }

      setConfirmed(true);
      setSubmitMessage(
        result.message || "Earned leave application submitted successfully.",
      );
      clearFormDraft("earned-leave");
      resetAfterSubmit();
      setDialogState("success");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unable to submit earned leave application.";
      setSubmitError(errorMessage);
      setDialogState(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogState(null);
    setOtpCode("");
  };

  const handleDownloadPdf = async () => {
    const form = formRef.current;
    if (!form) return;
    setIsDownloading(true);
    try {
      await downloadFormAsPdf(form, "Earned Leave");
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

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
          <SurfaceCard className="mx-auto max-w-4xl space-y-5 border border-slate-300 bg-white p-4 md:p-6">
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
                    नंगल रोड, रूपनगर, पंजाब-140001 / Nangal Road, Rupnagar,
                    Punjab-140001
                  </p>
                </div>
              </div>
              <p className="text-[12px] font-semibold">
                छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन / Application for
                Leave or Extension of Leave
              </p>
              <p className="text-[11px]">
                (अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड
                छुट्टी/विश्राम की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल
                देखभाल छुट्टी)
              </p>
              <p className="text-[11px]">
                (Earned Leave/Half Pay Leave/Extra Ordinary Leave/Commuted
                Leave/Vacation/Maternity Leave/Paternity Leave/Child Care Leave)
              </p>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full border border-slate-400 text-[12px] text-slate-900">
                <colgroup>
                  <col className="w-[36%]" />
                  <col />
                </colgroup>
                <tbody>
                  <Row
                    label="1. आवेदक का नाम / Name of the applicant"
                    inputId="name"
                  />
                  <Row label="2. पद नाम / Post held" inputId="post" />
                  <Row
                    label="3. विभाग/केन्द्रीय कार्यालय/अनुभाग / Department/Office/Section"
                    inputId="department"
                  />
                  <Row
                    label="4. अवकाश का प्रकार / Nature of Leave applied for"
                    inputId="leaveType"
                  />
                  <RowPeriod
                    fromDate={fromDate}
                    toDate={toDate}
                    fromSession={fromSession}
                    toSession={toSession}
                    computedLeaveDays={computedLeaveDays}
                    onFromDateChange={handlePeriodDateChange("fromDate")}
                    onToDateChange={handlePeriodDateChange("toDate")}
                    onFromSessionChange={setFromSession}
                    onToSessionChange={setToSession}
                  />
                  <RowPrefixSuffix />
                  <Row label="7. उद्देश्य / Purpose" inputId="purpose" />
                  <Row
                    label="8. कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था / Alternative arrangements"
                    inputId="arrangements"
                  />
                  <RowLtc ltcChoice={ltcChoice} setLtcChoice={setLtcChoice} />
                  <RowAddress />
                  <RowStation
                    stationLeaveRequired={stationLeaveRequired}
                    setStationLeaveRequired={setStationLeaveRequired}
                  />
                </tbody>
              </table>
            </div>

            <p className="text-right text-[12px] text-slate-900">
              आवेदक के हस्ताक्षर दिनांक सहित / Signature of the applicant with
              date:{" "}
              <input
                type="hidden"
                id="applicantSignature"
                name="applicantSignature"
                value={
                  signatureMode === "typed"
                    ? typedSignature
                    : DIGITAL_SIGNATURE_VALUE
                }
                readOnly
              />{" "}
              <span className="inline-flex h-9 w-40 items-end border-b border-dashed border-slate-400 px-1 pb-0.5 align-middle text-left text-[13px] text-slate-900">
                {signatureMode === "typed"
                  ? typedSignature
                  : "DIGITALLY_SIGNED"}
              </span>{" "}
              <DateUnderlineInput
                id="applicantSignatureDate"
                width="w-32"
                readOnly
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </p>

            <div className="space-y-2 border-t border-slate-400 pt-2 text-[12px] text-slate-900">
              <p className="font-semibold text-center">
                नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें / Remarks and
                Recommendations of the controlling officer
              </p>
              <p>
                सिफारिश की गई / Recommended या नहीं की गई / not recommended:{" "}
                <UnderlineInput id="recommended" width="w-44" readOnly />
              </p>
              <p>
                विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित / Signature
                with date Head of Department/Section In-charge:
                <UnderlineInput
                  id="hodSignature"
                  width="w-60"
                  className="ml-2"
                  readOnly
                />
              </p>
            </div>

            <div className="space-y-2 border-t border-slate-400 pt-2 text-[12px] text-slate-900">
              <p className="text-center font-semibold">
                प्रशासनिक अनुभाग द्वारा प्रयोग हेतु / For use by the
                Administration Section
              </p>
              <p>
                प्रमाणित किया जाता है कि (प्रकृति) / Certified that (nature of
                leave) for period, from
                <UnderlineInput id="adminFrom" width="w-32" readOnly /> to{" "}
                <UnderlineInput id="adminTo" width="w-32" readOnly /> is
                available as per following details:
              </p>
              <p>
                अवकाश का प्रकार / Nature of leave applied for{" "}
                <UnderlineInput id="adminLeaveType" width="w-44" readOnly /> आज
                की तिथि तक शेष / Balance as on date
                <UnderlineInput id="balance" width="w-28" readOnly /> कुल दिनों
                के लिए अवकाश / Leave applied for (No. of days)
                <UnderlineInput id="adminDays" width="w-24" readOnly />
              </p>
              <p>
                संबंधित सहायक / Dealing Assistant{" "}
                <UnderlineInput
                  id="assistant"
                  width="w-44"
                  className="ml-2"
                  readOnly
                />{" "}
                अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/ सुपdt./AR/DR
                <UnderlineInput
                  id="arDr"
                  width="w-44"
                  className="ml-2"
                  readOnly
                />{" "}
                कुलसचिव / Registrar
                <UnderlineInput
                  id="registrar"
                  width="w-44"
                  className="ml-2"
                  readOnly
                />
              </p>
              <p>
                छुट्टी स्वीकृत करने के लिए सक्षम प्राधिकारी की टिप्पणी: स्वीकृत
                / अस्वीकृत / Comments of the competent authority to grant leave:
                Sanctioned / Not Sanctioned
              </p>
              <p>
                कुलसचिव/ डीन (Faculty Affairs & Administration) / Director के
                हस्ताक्षर / Signature of Registrar / Dean (Faculty Affairs &
                Administration) / Director:
                <UnderlineInput
                  id="authoritySign"
                  width="w-60"
                  className="ml-2"
                  readOnly
                />
              </p>
            </div>
          </SurfaceCard>

          {submitError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          )}
          {submitMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {submitMessage}
            </div>
          )}

          <SignatureOtpVerificationCard
            signatureMode={signatureMode}
            onSignatureModeChange={onSignatureModeChange}
            typedSignature={typedSignature}
            onTypedSignatureChange={onTypedSignatureChange}
            otpEmail={otpEmail}
            otpCode={otpCode}
            onOtpCodeChange={setOtpCode}
            otpStatusMessage={otpStatusMessage}
            isSendingOtp={isSendingOtp}
            isVerifyingOtp={isVerifyingOtp}
            isSubmitting={isSubmitting}
            onSendOtp={handleSendOtp}
            onVerifyOtp={handleVerifyOtp}
            onSignatureChange={onSignatureChange}
            isOtpVerified={isOtpVerified}
          />

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-600">
              {confirmed
                ? "Submission confirmed. You can still edit and resubmit if needed."
                : missingFields.length > 0
                  ? "Please fill the highlighted fields."
                  : "Fill all fields, then submit."}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                className="px-4 text-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </form>

        <ConfirmationModal
          state={dialogState}
          title="Earned Leave"
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
  onConfirm: () => void;
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

const Row = ({ label, inputId }: { label: string; inputId: string }) => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">{label}</td>
    <td className="px-3 py-2">
      <UnderlineInput id={inputId} className="w-full" />
    </td>
  </tr>
);

const RowPeriod = ({
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
  onFromDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFromSessionChange: (value: DaySession) => void;
  onToSessionChange: (value: DaySession) => void;
}) => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      5. छुट्टी की अवधि/ Period of Leave
    </td>
    <td className="px-3 py-2 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span>से / From:</span>
        <DateUnderlineInput
          id="fromDate"
          width="w-32"
          min={getTodayIso()}
          value={fromDate}
          onChange={onFromDateChange}
        />
        <SessionSelect
          id="fromSession"
          value={fromSession}
          onChange={(value) => onFromSessionChange(value)}
        />
        <span>तक/To:</span>
        <DateUnderlineInput
          id="toDate"
          width="w-32"
          min={fromDate || getTodayIso()}
          value={toDate}
          onChange={onToDateChange}
        />
        <SessionSelect
          id="toSession"
          value={toSession}
          onChange={(value) => onToSessionChange(value)}
        />
        <span>दिनों की संख्या/No. of days:</span>
        <UnderlineInput
          id="days"
          width="w-20"
          readOnly
          value={computedLeaveDays}
        />
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

const RowPrefixSuffix = () => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      6. यदि कोई, रविवार और अवकाश, छुट्टी से पूर्व या पश्चात में लिए जा रहे हैं
      <div className="text-[11px] font-normal">
        Sunday and holiday, if any, proposed to be prefixed/suffixed to leave
      </div>
    </td>
    <td className="px-3 py-2 text-[12px] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>के पूर्व Prefix</span>
        <span>से/From:</span>
        <DateUnderlineInput id="prefixFromDate" width="w-28" />
        <span>तक/To:</span>
        <DateUnderlineInput id="prefixToDate" width="w-28" />
        <span>दिनों की संख्या/No. of days:</span>
        <UnderlineInput id="prefixDays" width="w-20" readOnly />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>के पश्चात Suffix</span>
        <span>से/From:</span>
        <DateUnderlineInput id="suffixFromDate" width="w-28" />
        <span>तक/To:</span>
        <DateUnderlineInput id="suffixToDate" width="w-28" />
        <span>दिनों की संख्या/No. of days:</span>
        <UnderlineInput id="suffixDays" width="w-20" readOnly />
      </div>
    </td>
  </tr>
);

const RowLtc = ({
  ltcChoice,
  setLtcChoice,
}: {
  ltcChoice: string;
  setLtcChoice: (value: string) => void;
}) => {
  const handleLtcChange = (value: "PROPOSE" | "NOT_PROPOSE") => {
    setLtcChoice(value);
    const form = document.querySelector<HTMLFormElement>("form");
    const hiddenInput = form?.querySelector<HTMLInputElement>("#ltc");
    if (hiddenInput) {
      hiddenInput.value = value;
    }
  };

  return (
    <tr className="border-t border-slate-400">
      <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
        9. I propose/do not propose to avail Leave Travel Concession during the
        leave.
      </td>
      <td className="px-3 py-2 text-[12px]">
        <input type="hidden" id="ltc" name="ltc" value={ltcChoice} readOnly />
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="ltcChoice"
              value="PROPOSE"
              checked={ltcChoice === "PROPOSE"}
              onChange={(e) =>
                handleLtcChange(e.target.value as "PROPOSE" | "NOT_PROPOSE")
              }
              className="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-500"
            />
            <span>Propose</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="ltcChoice"
              value="NOT_PROPOSE"
              checked={ltcChoice === "NOT_PROPOSE"}
              onChange={(e) =>
                handleLtcChange(e.target.value as "PROPOSE" | "NOT_PROPOSE")
              }
              className="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-500"
            />
            <span>Do not propose</span>
          </label>
        </div>
      </td>
    </tr>
  );
};

const RowAddress = () => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      10. अवकाश के दौरान पता / Address during the leave
    </td>
    <td className="px-3 py-2 space-y-2 text-[12px]">
      <UnderlineInput id="address" className="w-full" />
      <div className="flex flex-wrap items-center gap-3">
        <span>संपर्क नं. / Contact No.</span>
        <UnderlineInput
          id="contactNo"
          width="w-40"
          maxLength={10}
          pattern="\d{10}"
          inputMode="numeric"
        />
        <span>पिन / PIN:</span>
        <UnderlineInput
          id="pin"
          width="w-24"
          maxLength={6}
          pattern="\d{6}"
          inputMode="numeric"
        />
      </div>
    </td>
  </tr>
);

const RowStation = ({
  stationLeaveRequired,
  setStationLeaveRequired,
}: {
  stationLeaveRequired: string;
  setStationLeaveRequired: (value: string) => void;
}) => {
  const handleYesNoChange = (value: string) => {
    setStationLeaveRequired(value);
    const form = document.querySelector<HTMLFormElement>("form");
    if (form) {
      const hiddenInput = form.querySelector<HTMLInputElement>("#stationYesNo");
      if (hiddenInput) {
        hiddenInput.value = value;
      }
    }
  };

  return (
    <tr className="border-t border-slate-400">
      <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
        11. क्या स्टेशन अवकाश की आवश्यकता है / Whether Station leave is required
      </td>
      <td className="px-3 py-2 space-y-2 text-[12px]">
        <div className="flex flex-wrap items-center gap-3">
          <span>हाँ / Yes / No :</span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="stationLeaveRadio"
                value="Yes"
                checked={stationLeaveRequired === "Yes"}
                onChange={(e) => handleYesNoChange(e.target.value)}
                className="w-3.5 h-3.5 text-slate-600 border-slate-300 focus:ring-slate-500"
              />
              <span>हाँ / Yes</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="stationLeaveRadio"
                value="No"
                checked={stationLeaveRequired === "No"}
                onChange={(e) => handleYesNoChange(e.target.value)}
                className="w-3.5 h-3.5 text-slate-600 border-slate-300 focus:ring-slate-500"
              />
              <span>नहीं / No</span>
            </label>
          </div>
          <input
            type="hidden"
            id="stationYesNo"
            name="stationYesNo"
            value={stationLeaveRequired}
          />
        </div>
        {stationLeaveRequired === "Yes" && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span>यदि हाँ / If yes :</span>
            <span>से / From :</span>
            <DateUnderlineInput id="stationFrom" width="w-28" />
            <span>तक / To :</span>
            <DateUnderlineInput id="stationTo" width="w-28" />
          </div>
        )}
      </td>
    </tr>
  );
};
