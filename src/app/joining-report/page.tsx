"use client";

import type {
  FormEvent,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadFormAsPdf } from "@/lib/pdf-export";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  SignatureOtpVerificationCard,
  type SignatureCapture,
} from "../../components/leaves/signature-otp-verification-card";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { applyAutofillToForm, saveFormDraft } from "@/lib/form-autofill";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;

const DIGITAL_SIGNATURE_VALUE = "DIGITALLY_SIGNED";

type JoiningReportHistoryItem = {
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
  "fromDate",
  "toDate",
  "totalDays",
  "dutySession",
  "leaveCategory",
  "rejoinDate",
  "orderNo",
  "orderDate",
  "englishRejoin",
  "englishDays",
  "englishFrom",
  "englishTo",
  "englishOrder",
  "englishOrderDate",
  "signature",
  "signName",
  "signDesignation",
  "signedDate",
];

const UnderlineInput = ({
  id,
  width = "w-44",
  className,
  type = "text",
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <input
    id={id}
    name={id}
    type={type}
    className={cn(
      "inline-block align-baseline border-0 border-b border-dashed border-slate-400 bg-transparent px-1 pt-0 pb-0.5 text-sm leading-[1.05rem] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
    {...props}
  />
);

const DUTY_SESSION_OPTIONS = [
  { value: "Forenoon", label: "पूर्वाह्न / Forenoon" },
  { value: "Afternoon", label: "अपराह्न / Afternoon" },
] as const;

const LEAVE_CATEGORY_OPTIONS = [
  { value: "Earned Leave", label: "अर्जित छुट्टी / Earned Leave" },
  { value: "Half Pay Leave", label: "अर्ध वेतन छुट्टी / Half Pay Leave" },
  { value: "Medical Leave", label: "चिकित्सक छुट्टी / Medical Leave" },
  {
    value: "Extra Ordinary Leave",
    label: "असाधारण छुट्टी / Extra Ordinary Leave",
  },
  { value: "Vacation Leave", label: "Vacation Leave" },
] as const;

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

export default function JoiningReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const formRef = useRef<HTMLFormElement>(null);
  const pendingDataRef = useRef<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoleLocked, setIsRoleLocked] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<JoiningReportHistoryItem[]>([]);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStatusMessage, setOtpStatusMessage] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [signatureCapture, setSignatureCapture] =
    useState<SignatureCapture | null>(null);
  const [choiceValues, setChoiceValues] = useState({
    dutySession: "",
    leaveCategory: "",
  });
  const [workflowMessage, setWorkflowMessage] = useState(
    "This joining report will be routed automatically after submission.",
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
      setSubmitError("Joining report form is locked for Dean and Registrar.");
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

    const calculatedDays = calculateInclusiveDays(data.fromDate, data.toDate);
    data.totalDays = calculatedDays;
    data.englishDays = calculatedDays;
    data.englishFrom = data.fromDate;
    data.englishTo = data.toDate;
    data.englishRejoin = data.rejoinDate;
    data.englishOrderDate = data.orderDate;
    data.signature = DIGITAL_SIGNATURE_VALUE;
    if (!data.signedDate?.trim()) {
      data.signedDate = new Date().toISOString().slice(0, 10);
    }

    saveFormDraft("joining-report", data);
    const missing = requiredInputIds.filter((key) => !data[key]?.trim());
    const invalid = new Set<string>();

    if (!calculatedDays) {
      invalid.add("fromDate");
      invalid.add("toDate");
      invalid.add("totalDays");
      invalid.add("englishDays");
    }

    const flagged = new Set([...missing, ...invalid]);
    markMissingInputs(form, flagged);
    if (flagged.size > 0) {
      setMissingFields(Array.from(flagged));
      if (invalid.size > 0) {
        setSubmitError(
          "Please select a valid leave period. The To date must be the same as or later than the From date.",
        );
      }
      return;
    }

    if (!isOtpVerified || !signatureCapture) {
      setSubmitError(
        "Please complete Digital Signature and OTP verification on the form before submitting.",
      );
      return;
    }

    setMissingFields([]);
    setSubmitError(null);
    pendingDataRef.current = data;
    setDialogState("confirm");
  };

  const setFormFieldValue = useCallback((field: string, value: string) => {
    const form = formRef.current;
    if (!form) return;

    const input = form.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[name="${field}"]`,
    );

    if (input && input.value !== value) {
      input.value = value;
    }
  }, []);

  const syncDurationFields = useCallback(
    (fromValue: string, toValue: string) => {
      const days = calculateInclusiveDays(fromValue, toValue);
      setFormFieldValue("totalDays", days);
      setFormFieldValue("englishDays", days);
    },
    [setFormFieldValue],
  );

  const handlePeriodDateChange = (
    sourceField: "fromDate" | "toDate" | "englishFrom" | "englishTo",
    targetField: "englishFrom" | "englishTo" | "fromDate" | "toDate",
  ) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setFormFieldValue(targetField, nextValue);

      const fromValue =
        sourceField === "fromDate" || sourceField === "englishFrom"
          ? nextValue
          : (formRef.current?.querySelector<HTMLInputElement>(
              '[name="fromDate"]',
            )?.value ?? "");
      const toValue =
        sourceField === "toDate" || sourceField === "englishTo"
          ? nextValue
          : (formRef.current?.querySelector<HTMLInputElement>('[name="toDate"]')
              ?.value ?? "");

      syncDurationFields(fromValue, toValue);
    };
  };

  const handleMirroredDateChange = (
    targetField:
      | "englishRejoin"
      | "rejoinDate"
      | "englishOrderDate"
      | "orderDate",
  ) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormFieldValue(targetField, event.target.value);
    };
  };

  const handleChoiceChange = (field: "dutySession" | "leaveCategory") => {
    return (event: React.ChangeEvent<HTMLSelectElement>) => {
      setChoiceValues((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };
  };

  const handleConfirmSubmit = async () => {
    if (!isOtpVerified || !signatureCapture) {
      setSubmitError(
        "Complete digital signature and OTP verification before submitting.",
      );
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/joining-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          form: pendingDataRef.current,
          signature: signatureCapture,
          otpVerified: true,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          referenceCode?: string;
          approverName?: string;
          approverRole?: string;
          viewerOnly?: boolean;
        };
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to submit joining report.");
      }

      setSubmitMessage(
        `${result.message ?? "Joining report submitted successfully."}${result.data?.referenceCode ? ` Reference: ${result.data.referenceCode}.` : ""}`,
      );
      setConfirmed(true);
      setDialogState("success");
      setOtpCode("");
      setOtpStatusMessage(null);
      setIsOtpVerified(false);
      setSignatureCapture(null);
      await loadBootstrap();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit joining report.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogState(null);
    setOtpStatusMessage(null);
  };

  const handleVerifyOtp = async () => {
    if (!signatureCapture) {
      setOtpStatusMessage(
        "Please add your digital signature before OTP verification.",
      );
      setIsOtpVerified(false);
      return;
    }

    if (!otpEmail.trim()) {
      setOtpStatusMessage(
        "Unable to resolve your institute email for OTP verification.",
      );
      setIsOtpVerified(false);
      return;
    }

    if (otpCode.trim().length !== 6) {
      setOtpStatusMessage("Enter a valid 6-digit OTP.");
      setIsOtpVerified(false);
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code: otpCode.trim() }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to verify OTP.");
      }

      setIsOtpVerified(true);
      setOtpStatusMessage("OTP verified successfully.");
    } catch (err) {
      setIsOtpVerified(false);
      setOtpStatusMessage(
        err instanceof Error ? err.message : "Unable to verify OTP.",
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSendOtp = async () => {
    if (!otpEmail.trim()) {
      setOtpStatusMessage("Unable to resolve your institute email for OTP.");
      return;
    }

    setIsSendingOtp(true);
    setOtpStatusMessage(null);
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to send OTP.");
      }

      setOtpStatusMessage(result.message ?? "OTP sent to your email.");
    } catch (err) {
      setOtpStatusMessage(
        err instanceof Error ? err.message : "Unable to send OTP.",
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleDownloadPdf = async () => {
    const form = formRef.current;
    if (!form) return;
    setIsDownloading(true);
    try {
      await downloadFormAsPdf(form, "Joining Report");
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const loadBootstrap = useCallback(async () => {
    const form = formRef.current;

    try {
      const response = await fetch("/api/joining-report/bootstrap", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          defaults?: Record<string, string>;
          history?: JoiningReportHistoryItem[];
        };
      };

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "Unable to load joining report profile data.",
        );
      }

      const defaults = result.data?.defaults ?? {};
      if (form) {
        Object.entries(defaults).forEach(([key, value]) => {
          if (!value) return;
          const input = form.querySelector<
            HTMLInputElement | HTMLSelectElement
          >(`[name="${key}"]`);
          if (input && !input.value.trim()) {
            input.value = value;
          }
        });

        const fromValue =
          form.querySelector<HTMLInputElement>('[name="fromDate"]')?.value ??
          "";
        const toValue =
          form.querySelector<HTMLInputElement>('[name="toDate"]')?.value ?? "";
        syncDurationFields(fromValue, toValue);
        setChoiceValues({
          dutySession:
            form.querySelector<HTMLSelectElement>('[name="dutySession"]')
              ?.value ?? "",
          leaveCategory:
            form.querySelector<HTMLSelectElement>('[name="leaveCategory"]')
              ?.value ?? "",
        });
      }

      setHistory(result.data?.history ?? []);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to load joining report profile data.",
      );
    }
  }, [syncDurationFields]);

  useEffect(() => {
    const form = formRef.current;
    if (form) {
      void applyAutofillToForm(form, "joining-report").then((profile) => {
        setOtpEmail(profile.email ?? "");
      });
    }

    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const roleKeyRaw =
      typeof window !== "undefined"
        ? window.localStorage.getItem("lf-user-role")
        : null;

    if (roleKeyRaw === ROLE_KEYS.FACULTY) {
      setIsRoleLocked(false);
      setSubmitError(null);
      setWorkflowMessage(
        "On submit, your joining report will be forwarded to the HoD of your department for approval.",
      );
      return;
    }

    if (roleKeyRaw === ROLE_KEYS.STAFF) {
      setIsRoleLocked(false);
      setSubmitError(null);
      setWorkflowMessage(
        "On submit, your joining report will be forwarded to the Registrar for approval.",
      );
      return;
    }

    if (roleKeyRaw === ROLE_KEYS.HOD) {
      setIsRoleLocked(false);
      setSubmitError(null);
      setWorkflowMessage(
        "On submit, your joining report will be forwarded to the Dean for approval.",
      );
      return;
    }

    if (roleKeyRaw === ROLE_KEYS.DEAN || roleKeyRaw === ROLE_KEYS.REGISTRAR) {
      setIsRoleLocked(true);
      setWorkflowMessage(
        "Joining report form is locked for Dean and Registrar.",
      );
      setSubmitError("Joining report form is locked for Dean and Registrar.");
      return;
    }
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
          <SurfaceCard className="mx-auto max-w-3xl space-y-5 border-slate-200/80 bg-white p-6 md:p-10">
            <div className="flex flex-col items-center gap-3 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center gap-4 md:flex-nowrap md:justify-start">
                <div
                  className="flex items-center justify-center bg-white rounded-full border border-slate-200 p-2"
                  style={{ minWidth: 120, minHeight: 120 }}
                >
                  <Image
                    src="/iit_ropar.png"
                    alt="IIT Ropar"
                    width={120}
                    height={120}
                    priority
                    className="object-contain w-full h-full"
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
              विभागाध्यक्ष / रिपोर्टिंग अधिकारी द्वारा / Through HOD/Reporting
              Officer
            </p>

            <div className="text-center text-sm font-semibold text-slate-900">
              विषय / Sub : कार्यग्रहण प्रतिवेदन / JOINING REPORT
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-slate-900">
              <p>महोदय / Sir,</p>

              <p className="flex flex-wrap items-center gap-2 leading-relaxed">
                <span>मैं,</span>
                <UnderlineInput id="name" width="w-56" />
                <span>दिनांक</span>
                <DateUnderlineInput
                  id="fromDate"
                  width="w-36"
                  onChange={handlePeriodDateChange("fromDate", "englishFrom")}
                />
                <span>से</span>
                <DateUnderlineInput
                  id="toDate"
                  width="w-36"
                  onChange={handlePeriodDateChange("toDate", "englishTo")}
                />
                <span>तक</span>
                <UnderlineInput id="totalDays" width="w-16" readOnly />
                <span>दिन की</span>
                <InlineSelect
                  id="leaveCategory"
                  width="w-72"
                  options={LEAVE_CATEGORY_OPTIONS}
                  value={choiceValues.leaveCategory}
                  onChange={handleChoiceChange("leaveCategory")}
                />
              </p>

              <p className="flex flex-wrap items-center gap-2 leading-relaxed">
                <span>आज दिनांक</span>
                <DateUnderlineInput
                  id="rejoinDate"
                  width="w-36"
                  onChange={handleMirroredDateChange("englishRejoin")}
                />
                <span>को</span>
                <InlineSelect
                  id="dutySession"
                  width="w-52"
                  options={DUTY_SESSION_OPTIONS}
                  value={choiceValues.dutySession}
                  onChange={handleChoiceChange("dutySession")}
                />
                <span>
                  को अपना कार्यग्रहण प्रतिवेदन जमा कर रहा / रही हूँ, जो की
                  कार्यालय आदेश सं.
                </span>
                <UnderlineInput id="orderNo" width="w-48" />
                <span>दिनांक</span>
                <DateUnderlineInput
                  id="orderDate"
                  width="w-36"
                  onChange={handleMirroredDateChange("englishOrderDate")}
                />
                <span>के द्वारा स्वीकृत किया था।</span>
              </p>

              <p className="flex flex-wrap items-center gap-2 leading-relaxed">
                <span>I, hereby report myself for duty this day on</span>
                <DateUnderlineInput
                  id="englishRejoin"
                  width="w-40"
                  className="ml-2"
                  onChange={handleMirroredDateChange("rejoinDate")}
                />{" "}
                <span>
                  {choiceValues.dutySession || "forenoon / afternoon"} after
                  availing
                </span>
                <span>
                  {choiceValues.leaveCategory ||
                    "Earned Leave / Half Pay Leave / Medical Leave / Extra Ordinary Leave / Vacation Leave"}
                </span>
                <span>for</span>
                <UnderlineInput
                  id="englishDays"
                  width="w-16"
                  className="ml-2"
                  readOnly
                />{" "}
                <span>days from</span>
                <DateUnderlineInput
                  id="englishFrom"
                  width="w-40"
                  className="ml-2"
                  onChange={handlePeriodDateChange("englishFrom", "fromDate")}
                />{" "}
                <span>to</span>
                <DateUnderlineInput
                  id="englishTo"
                  width="w-40"
                  className="ml-2"
                  onChange={handlePeriodDateChange("englishTo", "toDate")}
                />{" "}
                <span>sanctioned vide Office Order No.</span>
                <UnderlineInput
                  id="englishOrder"
                  width="w-48"
                  className="ml-2"
                />{" "}
                <span>dated</span>
                <DateUnderlineInput
                  id="englishOrderDate"
                  width="w-36"
                  className="ml-2"
                  onChange={handleMirroredDateChange("orderDate")}
                />
                .
              </p>

              <div className="space-y-1 text-right">
                <p>भवदीय / Yours faithfully</p>
                <p>
                  हस्ताक्षर / Signature:{" "}
                  <UnderlineInput
                    id="signature"
                    width="w-56"
                    readOnly
                    defaultValue={DIGITAL_SIGNATURE_VALUE}
                  />
                </p>
                <p>
                  नाम / Name : <UnderlineInput id="signName" width="w-48" />
                </p>
                <p>
                  पदनाम / Designation:{" "}
                  <UnderlineInput id="signDesignation" width="w-44" />
                </p>
              </div>

              <p className="text-right">
                दिनांक / Dated:{" "}
                <DateUnderlineInput id="signedDate" width="w-40" />
              </p>
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-2 border-slate-200/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Routing</p>
            <p className="text-sm text-slate-600">{workflowMessage}</p>
          </SurfaceCard>

          {history.length > 0 ? (
            <SurfaceCard className="space-y-3 border-slate-200/80 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Recent joining reports
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
                      Status: {item.status} | Routed to: {item.approver}
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          ) : null}

          <SignatureOtpVerificationCard
            otpEmail={otpEmail}
            otpCode={otpCode}
            onOtpCodeChange={setOtpCode}
            otpStatusMessage={otpStatusMessage}
            isSendingOtp={isSendingOtp}
            isVerifyingOtp={isVerifyingOtp}
            isSubmitting={isSubmitting}
            onSendOtp={handleSendOtp}
            onVerifyOtp={handleVerifyOtp}
            onSignatureChange={(capture: SignatureCapture | null) => {
              setSignatureCapture(capture);
              setIsOtpVerified(false);
              setOtpStatusMessage(null);
            }}
            isOtpVerified={isOtpVerified}
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
          title="Joining Report"
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

const DateUnderlineInput = ({
  id,
  width = "w-36",
  className,
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <UnderlineInput
    id={id}
    type="date"
    width={width}
    className={cn("scheme-light", className)}
    {...props}
  />
);

const InlineSelect = ({
  id,
  width = "w-56",
  value,
  options,
  className,
  ...props
}: {
  id: string;
  width?: string;
  value: string;
  className?: string;
  options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">) => (
  <select
    id={id}
    name={id}
    value={value}
    className={cn(
      "inline-block rounded-none border-0 border-b border-dashed border-slate-400 bg-transparent px-1 pt-0 pb-0.5 text-sm leading-[1.05rem] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
    {...props}
  >
    <option value="">Select</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

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
              ? `${title} has been submitted successfully. You may close this window.`
              : `You are about to submit the ${title} form. Please review and confirm the details before continuing.`}
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
