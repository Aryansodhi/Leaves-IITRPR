"use client";

export const dynamic = "force-dynamic";

import type { FormEvent, InputHTMLAttributes } from "react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SignatureOtpVerificationCard } from "@/components/leaves/signature-otp-verification-card";
import { ProposedActingHodField } from "@/components/leaves/proposed-acting-hod-field";
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
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  applyAutofillToForm,
  getFormDraft,
  saveFormDraft,
  type AutofillProfile,
} from "@/lib/form-autofill";
import { downloadFormAsPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;

type WitnessSearchResult = {
  id: string;
  name: string;
  email: string;
  employeeCode?: string | null;
  designation?: string | null;
  department?: string | null;
};

type SignatureProof = {
  image?: string;
};

type ApprovalStepDetails = {
  actor: string;
  sequence?: number | null;
  status?: string | null;
  actedAt?: string | null;
  remarks?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email?: string | null;
    employeeCode?: string | null;
    designation?: string | null;
    department?: { name?: string | null } | null;
  } | null;
  metadata?: {
    role?: string;
    approverSignatureProof?: SignatureProof;
    requestedAt?: string;
    reminderAt?: string;
  } | null;
};

type WitnessRequestMetadata = {
  sequence?: number;
  requestedAt?: string;
};

type ExIndiaApplicationDetails = {
  metadata?: {
    formData?: Record<string, string>;
    witnessRequests?: WitnessRequestMetadata[];
  } | null;
  approvalSteps?: ApprovalStepDetails[];
};

const isWitnessStep = (step: ApprovalStepDetails) =>
  step.metadata?.role === "witness";

const formatWitnessStatus = (step?: ApprovalStepDetails | null) => {
  if (!step?.assignedTo) return "Not sent";
  if (step.status === "APPROVED") return "Approved";
  if (step.status === "REJECTED") return "Rejected";
  if (step.status === "IN_REVIEW") return "In review";
  return "Pending";
};

const witnessStatusClass = (step?: ApprovalStepDetails | null) => {
  if (step?.status === "APPROVED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (step?.status === "REJECTED") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  if (step?.assignedTo) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
};

const isSignatureFieldId = (fieldId: string) =>
  /signature/i.test(fieldId) || /Sign$/.test(fieldId);

const UnderlineInput = ({
  id,
  width = "w-48",
  className,
  readOnly,
  defaultValue,
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) => {
  const autoSigned = isSignatureFieldId(id);

  return (
    <input
      id={id}
      name={id}
      type="text"
      readOnly={readOnly ?? autoSigned}
      defaultValue={
        defaultValue ?? (autoSigned ? DIGITAL_SIGNATURE_VALUE : undefined)
      }
      className={cn(
        "border-0 border-b border-dashed border-slate-500 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none",
        (readOnly ?? autoSigned) && "cursor-not-allowed bg-slate-50 opacity-75",
        width,
        className,
      )}
      {...props}
    />
  );
};

const pages = [
  "Form page",
  "Ex-India letter",
  "Undertaking (Form I)",
  "Undertaking (Form II)",
] as const;

export default function ExIndiaLeavePage() {
  return (
    <Suspense fallback={null}>
      <ExIndiaLeavePageContent />
    </Suspense>
  );
}

function ExIndiaLeavePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [page, setPage] = useState(0);
  const isLastPage = page === pages.length - 1;
  const formRef = useRef<HTMLFormElement>(null);
  const pendingDataRef = useRef<Record<string, string>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fromSession, setFromSession] = useState<DaySession>("MORNING");
  const [toSession, setToSession] = useState<DaySession>("EVENING");
  const [computedDays, setComputedDays] = useState("");
  const [leaveType, setLeaveType] = useState(
    () => getFormDraft("ex-india-leave")?.leaveType ?? "",
  );
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

  const [leaveBalance, setLeaveBalance] = useState<{
    totalAllocated: number;
    totalConsumed: number;
    totalEncashed: number;
    available: number;
  } | null>(null);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);

  const [witness1Id, setWitness1Id] = useState<string | null>(null);
  const [witness2Id, setWitness2Id] = useState<string | null>(null);
  const [witness1Query, setWitness1Query] = useState("");
  const [witness2Query, setWitness2Query] = useState("");
  const [witness1Results, setWitness1Results] = useState<WitnessSearchResult[]>(
    [],
  );
  const [witness2Results, setWitness2Results] = useState<WitnessSearchResult[]>(
    [],
  );
  const [witness1Profile, setWitness1Profile] =
    useState<WitnessSearchResult | null>(null);
  const [witness2Profile, setWitness2Profile] =
    useState<WitnessSearchResult | null>(null);
  const [isSearchingWitness1, setIsSearchingWitness1] = useState(false);
  const [isSearchingWitness2, setIsSearchingWitness2] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [applicationDetails, setApplicationDetails] =
    useState<ExIndiaApplicationDetails | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [witnessRequestTimes, setWitnessRequestTimes] = useState<
    Record<1 | 2, string | null>
  >({ 1: null, 2: null });
  const [applicantProfile, setApplicantProfile] =
    useState<AutofillProfile | null>(null);
  const [draftSnapshot, setDraftSnapshot] = useState<Record<string, string>>(
    getFormDraft("ex-india-leave") ?? {},
  );
  const [isDirty, setIsDirty] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

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

  const handleBackNav = () => {
    if (page > 0) {
      prev();
      return;
    }
    if (isDirty && !confirmed) {
      setExitDialogOpen(true);
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

  const exitForm = (saveDraft: boolean) => {
    if (saveDraft) persistDraftFromForm();
    setExitDialogOpen(false);
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      const safeReturnTo =
        returnTo && returnTo.startsWith("/") ? returnTo : "/";
      router.push(safeReturnTo);
    }
  };

  const persistDraftFromForm = () => {
    const form = formRef.current;
    if (!form) return;
    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const existing = getFormDraft("ex-india-leave") ?? {};
    const effectiveFromDate =
      data.fromDate || fromDate || existing.fromDate || "";
    const effectiveToDate = data.toDate || toDate || existing.toDate || "";
    data.fromSession = fromSession;
    data.toSession = toSession;
    data.fromDate = effectiveFromDate;
    data.toDate = effectiveToDate;
    data.leaveType = data.leaveType || leaveType || existing.leaveType || "";
    const recomputedDays = computeSessionLeaveDaysFromInput(
      effectiveFromDate,
      fromSession,
      effectiveToDate,
      toSession,
    );
    const recomputedDaysLabel = recomputedDays
      ? formatSessionDays(recomputedDays)
      : "";
    data.days = recomputedDaysLabel;
    setComputedDays(recomputedDaysLabel);
    Object.keys(data).forEach((key) => {
      if (isSignatureFieldId(key)) {
        data[key] = DIGITAL_SIGNATURE_VALUE;
      }
    });
    const merged = { ...existing, ...data };
    saveFormDraft("ex-india-leave", merged);
    setDraftSnapshot(merged);
  };

  const next = () => {
    persistDraftFromForm();
    setPage((p) => Math.min(p + 1, pages.length - 1));
  };
  const prev = () => {
    persistDraftFromForm();
    setPage((p) => Math.max(p - 1, 0));
  };

  const loadApplicationDetails = useCallback(async (id: string) => {
    const detailsRes = await fetch(`/api/ex-india-leave/${id}`, {
      cache: "no-store",
    });
    const detailsJson = await detailsRes.json();
    if (detailsJson?.ok) {
      setApplicationDetails(detailsJson.data);
    }
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLastPage) {
      next();
      return;
    }

    if (!canFinalizeSubmit) {
      window.alert(
        "Witness approvals are pending. Submit after both witnesses approve.",
      );
      return;
    }

    setConfirmed(false);
    const form = formRef.current;
    if (!form) return;
    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const existing = getFormDraft("ex-india-leave") ?? {};
    const effectiveFromDate =
      data.fromDate || fromDate || existing.fromDate || "";
    const effectiveToDate = data.toDate || toDate || existing.toDate || "";
    data.fromSession = fromSession;
    data.toSession = toSession;
    data.fromDate = effectiveFromDate;
    data.toDate = effectiveToDate;
    data.leaveType = data.leaveType || leaveType || existing.leaveType || "";
    const recomputedDays = computeSessionLeaveDaysFromInput(
      effectiveFromDate,
      fromSession,
      effectiveToDate,
      toSession,
    );
    const recomputedDaysLabel = recomputedDays
      ? formatSessionDays(recomputedDays)
      : "";
    data.days = recomputedDaysLabel;
    setComputedDays(recomputedDaysLabel);
    Object.keys(data).forEach((key) => {
      if (isSignatureFieldId(key)) {
        data[key] = DIGITAL_SIGNATURE_VALUE;
      }
    });
    saveFormDraft("ex-india-leave", { ...existing, ...data });
    const required = Array.from(
      form.querySelectorAll<HTMLInputElement>("input"),
    )
      .map((input) => input.name || input.id)
      .filter(Boolean);
    const missing = required.filter((key) => !data[key]?.trim());
    const missingSet = new Set(missing);
    markMissingInputs(form, missingSet);
    if (missingSet.size > 0) {
      setMissingFields(Array.from(missingSet));
      return;
    }

    if (!recomputedDaysLabel) {
      window.alert(
        "No. of days is auto-calculated from date/session and must be greater than 0.",
      );
      return;
    }

    const leaveTypeValue =
      data.leaveType ??
      form.querySelector<HTMLSelectElement>("#leaveType")?.value ??
      "";
    if (
      leaveTypeValue.toLowerCase().includes("earned") &&
      leaveBalance &&
      !Number.isNaN(parseFloat(computedDays)) &&
      parseFloat(computedDays) > leaveBalance.available
    ) {
      window.alert(
        `Requested days exceed available earned leave (${leaveBalance.available}). Please adjust dates or choose another leave type.`,
      );
      return;
    }

    const signatureError = ensureReadyForSubmit({
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

  const searchUsers = async (
    q: string,
    setResults: (value: WitnessSearchResult[]) => void,
    setIsSearching: (value: boolean) => void,
  ) => {
    const query = q.trim();
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(query)}`,
      );
      const json = await res.json();
      if (json?.ok) setResults(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    void searchUsers("", setWitness1Results, setIsSearchingWitness1);
    void searchUsers("", setWitness2Results, setIsSearchingWitness2);
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    setBalanceLoaded(false);
    void applyAutofillToForm(form, "ex-india-leave")
      .then((profile) => {
        setOtpEmail(profile.email ?? "");
        setApplicantProfile(profile);
        setLeaveBalance(profile.earnedLeaveBalance ?? null);
        const fromDateInput = form.querySelector<HTMLInputElement>("#fromDate");
        const toDateInput = form.querySelector<HTMLInputElement>("#toDate");
        const fromSessionInput =
          form.querySelector<HTMLSelectElement>("#fromSession");
        const toSessionInput =
          form.querySelector<HTMLSelectElement>("#toSession");
        const leaveTypeInput =
          form.querySelector<HTMLSelectElement>("#leaveType");

        if (fromDateInput) setFromDate(fromDateInput.value);
        if (toDateInput) setToDate(toDateInput.value);
        if (fromSessionInput) {
          setFromSession(fromSessionInput.value as DaySession);
        }
        if (toSessionInput) {
          setToSession(toSessionInput.value as DaySession);
        }
        if (leaveTypeInput) {
          setLeaveType(leaveTypeInput.value);
        }
      })
      .catch(() => {
        setLeaveBalance(null);
      })
      .finally(() => {
        setBalanceLoaded(true);
      });
  }, [page, setOtpEmail]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || confirmed) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [confirmed, isDirty]);

  useEffect(() => {
    if (!leaveBalance) {
      setBalanceWarning(null);
      return;
    }
    if (leaveType.toLowerCase().includes("earned") && computedDays) {
      const requested = parseFloat(computedDays);
      if (!Number.isNaN(requested) && requested > leaveBalance.available) {
        const shortage = (requested - leaveBalance.available).toFixed(1);
        setBalanceWarning(
          `You are requesting ${requested} days but only ${leaveBalance.available} days are available. Short by ${shortage} days.`,
        );
        return;
      }
    }
    setBalanceWarning(null);
  }, [computedDays, leaveBalance, leaveType]);

  useEffect(() => {
    const value = computeSessionLeaveDaysFromInput(
      fromDate,
      fromSession,
      toDate,
      toSession,
    );
    setComputedDays(value ? formatSessionDays(value) : "");
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
    window.scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!applicationId) return;

    void loadApplicationDetails(applicationId);
    const interval = window.setInterval(() => {
      void loadApplicationDetails(applicationId);
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [applicationId, loadApplicationDetails]);

  useEffect(() => {
    const requests = applicationDetails?.metadata?.witnessRequests;
    if (!Array.isArray(requests)) return;
    const next: Record<1 | 2, string | null> = { 1: null, 2: null };
    for (const [idx, req] of requests.entries()) {
      const seq = req?.sequence ?? idx + 1;
      if (seq === 1) next[1] = req.requestedAt ?? null;
      if (seq === 2) next[2] = req.requestedAt ?? null;
    }
    if (next[1] || next[2]) setWitnessRequestTimes(next);
  }, [applicationDetails]);

  const witnessSteps = applicationDetails?.approvalSteps?.filter(isWitnessStep);
  const witnessesApproved =
    witnessSteps?.length === 2 &&
    witnessSteps.every((step) => step.status === "APPROVED");
  const canFinalizeSubmit = Boolean(applicationId && witnessesApproved);

  const handleFooterPrimaryAction = () => {
    if (!isLastPage) {
      next();
      return;
    }
    formRef.current?.requestSubmit();
  };

  const handleConfirmSubmit = async () => {
    if (!canFinalizeSubmit) {
      window.alert(
        "Witness approvals are pending. Submit after both witnesses approve.",
      );
      setDialogState(null);
      return;
    }
    const signatureError = ensureReadyForSubmit({
      digital:
        "Complete digital signature and OTP verification before submitting.",
    });
    if (signatureError) {
      window.alert(signatureError);
      return;
    }

    setConfirmed(true);
    setIsDirty(false);
    setDialogState("success");
    resetAfterSubmit();
    window.localStorage?.removeItem?.("lf-draft-ex-india-leave");
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
      await downloadFormAsPdf(form, "Ex-India Leave");
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const createWitnessRequestApplication = async (slot: 1 | 2) => {
    const selectedWitnessId = slot === 1 ? witness1Id : witness2Id;
    if (!selectedWitnessId) {
      window.alert(`Select Witness ${slot} before sending.`);
      return null;
    }

    persistDraftFromForm();
    const form = formRef.current;
    if (!form) return null;

    const draft = getFormDraft("ex-india-leave") ?? {};
    const data = {
      ...draft,
      witness1Id: slot === 1 ? selectedWitnessId : (witness1Id ?? ""),
      witness2Id: slot === 2 ? selectedWitnessId : (witness2Id ?? ""),
      fromSession,
      toSession,
      fromDate: draft.fromDate || fromDate,
      toDate: draft.toDate || toDate,
      days: computedDays || draft.days || "",
    };

    try {
      const response = await fetch("/api/ex-india-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: data,
          signature: signatureCapture,
          otpVerified: isOtpVerified,
        }),
      });
      const result = await response.json();
      if (!result.ok)
        throw new Error(result.message || "Unable to send witness requests.");

      setApplicationId(result.data?.id ?? null);
      setWitnessRequestTimes((prev) => ({
        ...prev,
        [slot]: new Date().toISOString(),
      }));

      if (result.data?.id) {
        await loadApplicationDetails(result.data.id);
      }

      window.alert(`Witness ${slot} notified.`);
      return result.data?.id ?? null;
    } catch (err) {
      console.error(err);
      window.alert(
        (err as Error)?.message ?? "Unable to send witness requests.",
      );
      return null;
    }
  };

  const pageLabel = useMemo(
    () => `${pages[page]} (${page + 1}/${pages.length})`,
    [page],
  );

  return (
    <DashboardShell>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onChange={() => setIsDirty(true)}
        className="space-y-3 sm:space-y-4"
      >
        <input
          type="hidden"
          id="witness1Id"
          name="witness1Id"
          value={witness1Id ?? ""}
        />
        <input
          type="hidden"
          id="witness2Id"
          name="witness2Id"
          value={witness2Id ?? ""}
        />
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={handleBackNav}
            className="px-0 text-sm font-semibold text-slate-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {pageLabel}
          </span>
        </div>

        {page === 0 && (
          <FormPage
            fromDate={fromDate}
            toDate={toDate}
            fromSession={fromSession}
            toSession={toSession}
            leaveType={leaveType}
            computedDays={computedDays}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            onFromSessionChange={setFromSession}
            onToSessionChange={setToSession}
            onLeaveTypeChange={setLeaveType}
            signatureCapture={signatureCapture}
            leaveBalance={leaveBalance}
            balanceLoaded={balanceLoaded}
            balanceWarning={balanceWarning}
          />
        )}
        {page === 1 && (
          <LetterPage
            signatureCapture={signatureCapture}
            fromDate={fromDate}
            toDate={toDate}
            computedDays={computedDays}
          />
        )}
        {page === 2 && (
          <UndertakingFormOne
            applicationDetails={applicationDetails}
            formData={applicationDetails?.metadata?.formData ?? draftSnapshot}
            applicantProfile={applicantProfile}
            witness1Id={witness1Id}
            witness2Id={witness2Id}
            witness1Query={witness1Query}
            witness2Query={witness2Query}
            onWitness1QueryChange={(value) => {
              setWitness1Query(value);
              void searchUsers(
                value,
                setWitness1Results,
                setIsSearchingWitness1,
              );
            }}
            onWitness2QueryChange={(value) => {
              setWitness2Query(value);
              void searchUsers(
                value,
                setWitness2Results,
                setIsSearchingWitness2,
              );
            }}
            isSearchingWitness1={isSearchingWitness1}
            isSearchingWitness2={isSearchingWitness2}
            witness1Results={witness1Results}
            witness2Results={witness2Results}
            applicantEmail={otpEmail}
            witnessRequestTimes={witnessRequestTimes}
            witness1Profile={witness1Profile}
            witness2Profile={witness2Profile}
            signatureCapture={signatureCapture}
            nowMs={nowMs}
            onSelect={async (slot, id) => {
              const requestedAt = witnessRequestTimes[slot];
              const currentId = slot === 1 ? witness1Id : witness2Id;
              if (requestedAt && id && id !== currentId) {
                const shouldChange = window.confirm(
                  "This witness has already been requested. Do you want to change the witness?",
                );
                if (!shouldChange) return;
                if (applicationId) {
                  try {
                    const response = await fetch(
                      "/api/ex-india-leave/send-witness-request",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          applicationId,
                          witnessId: id,
                          sequence: slot,
                        }),
                      },
                    );
                    const json = await response.json();
                    if (!json.ok) {
                      throw new Error(
                        json.error || "Unable to change witness.",
                      );
                    }
                    const detailsRes = await fetch(
                      `/api/ex-india-leave/${applicationId}`,
                    );
                    const detailsJson = await detailsRes.json();
                    if (detailsJson?.ok)
                      setApplicationDetails(detailsJson.data);
                    setWitnessRequestTimes((prev) => ({
                      ...prev,
                      [slot]: new Date().toISOString(),
                    }));
                  } catch (err) {
                    console.error(err);
                    window.alert("Unable to change witness. Please try again.");
                    return;
                  }
                }
              }
              if (slot === 1) {
                setWitness1Id(id);
                const selected =
                  witness1Results.find((r) => r.id === id) ?? null;
                setWitness1Profile(selected);
              }
              if (slot === 2) {
                setWitness2Id(id);
                const selected =
                  witness2Results.find((r) => r.id === id) ?? null;
                setWitness2Profile(selected);
              }
            }}
            applicationId={applicationId}
            onWitnessRequestSent={(slot, timestamp) =>
              setWitnessRequestTimes((prev) => ({ ...prev, [slot]: timestamp }))
            }
            onCreateWitnessApplication={createWitnessRequestApplication}
          />
        )}
        {page === 3 && (
          <UndertakingFormTwo
            applicationDetails={applicationDetails}
            formData={applicationDetails?.metadata?.formData ?? draftSnapshot}
            witness1Profile={witness1Profile}
            witness2Profile={witness2Profile}
            applicantProfile={applicantProfile}
            signatureCapture={signatureCapture}
          />
        )}

        <ProposedActingHodField />

        <SignatureOtpVerificationCard
          storageScope="ex-india-leave"
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
          isSubmitting={false}
          onSendOtp={handleSendOtp}
          onVerifyOtp={handleVerifyOtp}
          onSignatureChange={onSignatureChange}
          isOtpVerified={isOtpVerified}
        />

        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 sm:px-4 sm:py-3">
          {confirmed
            ? "Submission confirmed. You can still edit and resubmit if needed."
            : missingFields.length > 0
              ? "Please fill the highlighted fields."
              : "Fill all fields, then submit."}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 sm:pt-3">
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
              type="button"
              onClick={handleFooterPrimaryAction}
              className="px-4 text-sm"
              disabled={isLastPage ? !canFinalizeSubmit : false}
            >
              {isLastPage ? "Submit" : "Next"}
              {!isLastPage && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>

        <ConfirmationModal
          state={dialogState}
          title="Ex-India Leave"
          onCancel={handleCloseDialog}
          onConfirm={handleConfirmSubmit}
          onDownload={handleDownloadPdf}
          isDownloading={isDownloading}
        />

        <ExitConfirmModal
          open={exitDialogOpen}
          onCancel={() => setExitDialogOpen(false)}
          onExit={() => exitForm(false)}
          onSaveAndExit={() => exitForm(true)}
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
}: {
  state: DialogState;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  onDownload: () => void;
  isDownloading: boolean;
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
              >
                Yes, submit
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ExitConfirmModal = ({
  open,
  onCancel,
  onExit,
  onSaveAndExit,
}: {
  open: boolean;
  onCancel: () => void;
  onExit: () => void;
  onSaveAndExit: () => void;
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-slate-900">
          Leave this form?
        </h2>
        <p className="mt-2 text-xs text-slate-600">
          You have unsaved changes. Choose an option below.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={onExit}>
            Exit without saving
          </Button>
          <Button type="button" onClick={onSaveAndExit}>
            Save draft and exit
          </Button>
        </div>
      </div>
    </div>
  );
};

const FormPage = ({
  fromDate,
  toDate,
  fromSession,
  toSession,
  leaveType,
  computedDays,
  onFromDateChange,
  onToDateChange,
  onFromSessionChange,
  onToSessionChange,
  onLeaveTypeChange,
  signatureCapture,
  leaveBalance,
  balanceLoaded,
  balanceWarning,
}: {
  fromDate: string;
  toDate: string;
  fromSession: DaySession;
  toSession: DaySession;
  leaveType: string;
  computedDays: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onFromSessionChange: (value: DaySession) => void;
  onToSessionChange: (value: DaySession) => void;
  onLeaveTypeChange: (value: string) => void;
  signatureCapture?: { image?: string } | null;
  leaveBalance?: { available: number } | null;
  balanceLoaded?: boolean;
  balanceWarning?: string | null;
}) => (
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
        व्यक्तिगत आधार पर भारत के बाहर यात्रा के लिए छुट्टी या छुट्टी के विस्तार
        के लिए आवेदन /
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
          <Row label="1. आवेदक का नाम / Name of the applicant" inputId="name" />
          <Row label="2. पद नाम / Post held" inputId="post" />
          <Row
            label="3. विभाग/केन्द्रीय कार्यालय/अनुभाग/Department./Office/Section"
            inputId="department"
          />
          <tr className="border-t border-slate-400">
            <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
              4. अवकाश का प्रकार / Nature of Leave applied for
            </td>
            <td className="px-3 py-2 text-[12px]">
              <select
                id="leaveType"
                name="leaveType"
                value={leaveType}
                onChange={(event) => onLeaveTypeChange(event.target.value)}
                className="w-64 rounded border px-2 py-1 text-sm"
              >
                <option value="">-- Select --</option>
                <option value="Earned Leave">Earned Leave</option>
                <option value="Leave Without Pay">Leave Without Pay</option>
                <option value="Special Leave">Special Leave</option>
                <option value="Other">Other</option>
              </select>
              {balanceLoaded === false ? (
                <div className="mt-1 text-sm text-slate-500">
                  Checking balance…
                </div>
              ) : leaveBalance ? (
                <div className="mt-1 text-sm text-slate-700">
                  Available: {leaveBalance.available} days
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-500">
                  Balance unavailable
                </div>
              )}
            </td>
          </tr>
          <RowPeriod
            fromDate={fromDate}
            toDate={toDate}
            fromSession={fromSession}
            toSession={toSession}
            computedDays={computedDays}
            balanceWarning={balanceWarning}
            onFromDateChange={onFromDateChange}
            onToDateChange={onToDateChange}
            onFromSessionChange={onFromSessionChange}
            onToSessionChange={onToSessionChange}
          />
          <RowPrefixSuffix />
          <Row label="7. उद्देश्य / Purpose of the visit" inputId="purpose" />
          <Row
            label="8. कार्य, प्रशासनिक जिम्मेदारियों आदि (यदि कोई हो) के लिए वैकल्पिक व्यवस्था / Alternative arrangements"
            inputId="arrangements"
          />
          <RowDocs />
          <RowAddress />
        </tbody>
      </table>
    </div>

    <p className="text-right text-[12px] text-slate-900">
      आवेदक के हस्ताक्षर दिनांक सहित / Signature of the applicant with date:{" "}
      {signatureCapture?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signatureCapture.image}
          alt="applicant-signature"
          className="inline-block h-14"
        />
      ) : (
        <UnderlineInput id="applicantSignature" width="w-60" />
      )}
    </p>

    <div className="space-y-2 border-t border-slate-400 pt-2 text-[11px] text-slate-900 sm:text-[12px]">
      <p className="font-semibold text-center">
        नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें / Remarks and
        Recommendations of the controlling officer
      </p>
      <div className="space-y-2">
        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <p className="leading-snug">
            सिफारिश की गई / Recommended या नहीं की गई / not recommended:
          </p>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="recommended" width="w-full" readOnly />
          </div>
        </div>
        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <p className="leading-snug">
            विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित / Signature
            with date Head of Department/Section In-charge:
          </p>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="hodSignature" width="w-full" readOnly />
          </div>
        </div>
      </div>
    </div>

    <div className="space-y-2 border-t border-slate-400 pt-2 text-[11px] text-slate-900 sm:text-[12px]">
      <p className="text-center font-semibold">
        प्रशासनिक अनुभाग द्वारा प्रयोग हेतु / For use by the Administration
        Section
      </p>
      <div className="space-y-2">
        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <div className="space-y-1 leading-snug">
            <p>
              प्रमाणित किया जाता है कि (प्रकृति) / Certified that (nature of
              leave) for period:
            </p>
            <p>is available as per following details:</p>
          </div>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <span>from</span>
              <UnderlineInput id="adminFrom" width="w-full" readOnly />
              <span>to</span>
              <UnderlineInput id="adminTo" width="w-full" readOnly />
            </div>
          </div>
        </div>

        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <p className="leading-snug">
            अवकाश का प्रकार / Nature of leave applied for
          </p>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="adminLeaveType" width="w-full" readOnly />
          </div>
        </div>

        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <p className="leading-snug">आज की तिथि तक शेष / Balance as on date</p>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="balance" width="w-full" readOnly />
          </div>
        </div>

        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <p className="leading-snug">
            कुल दिनों के लिए अवकाश / Leave applied for (No. of days)
          </p>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="adminDays" width="w-full" readOnly />
          </div>
        </div>

        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <p className="leading-snug">संबंधित सहायक / Dealing Assistant</p>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="assistant" width="w-full" readOnly />
          </div>
        </div>

        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <p className="leading-snug">Jr. Supdt.</p>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="jrSupdt" width="w-full" readOnly />
          </div>
        </div>

        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <p className="leading-snug">
            अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/ सुपdt./AR/DR
          </p>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="arDr" width="w-full" readOnly />
          </div>
        </div>

        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
          <p className="leading-snug">
            कुलसचिव/ अधिकारी (Faculty Affairs & Administration) के हस्ताक्षर /
            Signature of Registrar / Dean (Faculty Affairs & Administration)
          </p>
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="registrarSign" width="w-full" />
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
          <div className="w-full lg:w-[22rem] lg:justify-self-end">
            <UnderlineInput id="directorSign" width="w-full" />
          </div>
        </div>
      </div>
    </div>
  </SurfaceCard>
);

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
  computedDays,
  balanceWarning,
  onFromDateChange,
  onToDateChange,
  onFromSessionChange,
  onToSessionChange,
}: {
  fromDate: string;
  toDate: string;
  fromSession: DaySession;
  toSession: DaySession;
  computedDays: string;
  balanceWarning?: string | null;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onFromSessionChange: (value: DaySession) => void;
  onToSessionChange: (value: DaySession) => void;
}) => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      5. छुट्टी की अवधि / Period of Leave
    </td>
    <td className="px-3 py-2 text-[12px]">
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <span>से / From:</span>
          <UnderlineInput
            id="fromDate"
            type="date"
            width="w-full"
            min={getTodayIso()}
            value={fromDate}
            onChange={(event) => onFromDateChange(event.target.value)}
          />
          <SessionSelect
            id="fromSession"
            value={fromSession}
            onChange={onFromSessionChange}
          />
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <span>तक / To:</span>
          <UnderlineInput
            id="toDate"
            type="date"
            width="w-full"
            min={fromDate || getTodayIso()}
            value={toDate}
            onChange={(event) => onToDateChange(event.target.value)}
          />
          <SessionSelect
            id="toSession"
            value={toSession}
            onChange={onToSessionChange}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2">
          <span>दिनों की संख्या / No. of days:</span>
          <UnderlineInput
            id="days"
            width="w-full"
            readOnly
            value={computedDays}
          />
        </div>
        {balanceWarning ? (
          <div className="mt-2 text-sm text-red-700">{balanceWarning}</div>
        ) : null}
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
      6. रविवार, अवकाश और अवकाश, छुट्टी से पहले या पश्चात मिलाना चाहते हैं
      <div className="text-[11px] font-normal">
        Sunday and Holiday, if any, proposed to be prefixed/suffixed to leave
      </div>
    </td>
    <td className="px-3 py-2 text-[12px] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>के पूर्व Prefix</span>
        <UnderlineInput id="prefixFrom" width="w-28" />
        <span>से / From:</span>
        <UnderlineInput id="prefixFromDate" width="w-28" />
        <span>तक / To:</span>
        <UnderlineInput id="prefixToDate" width="w-28" />
        <span>दिनों की संख्या / No. of days:</span>
        <UnderlineInput id="prefixDays" width="w-20" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>के पश्चात Suffix</span>
        <UnderlineInput id="suffixFrom" width="w-28" />
        <span>से / From:</span>
        <UnderlineInput id="suffixFromDate" width="w-28" />
        <span>तक / To:</span>
        <UnderlineInput id="suffixToDate" width="w-28" />
        <span>दिनों की संख्या / No. of days:</span>
        <UnderlineInput id="suffixDays" width="w-20" />
      </div>
    </td>
  </tr>
);

const RowDocs = () => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      9. मैं उपयुक्त दस्तावेज संलग्न कर रहा/रही हूँ / I am attaching the
      following necessary documents alongwith the form:
    </td>
    <td className="px-3 py-2 text-[12px] space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span>(i) Application addressed to the Director :</span>
        <span>Yes / No</span>
        <UnderlineInput id="docDirector" width="w-20" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span>(ii) Undertaking / agreement (Form I & Form 2)</span>
        <span>:</span>
        <span>Yes / No</span>
        <UnderlineInput id="docAgreement" width="w-20" />
      </div>
    </td>
  </tr>
);

const RowAddress = () => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      10. अवकाश के दौरान पता / Address during the leave
    </td>
    <td className="px-3 py-2 space-y-2 text-[12px]">
      <UnderlineInput id="address" className="w-full" />
      <div className="flex flex-wrap items-center gap-3">
        <span>संपर्क नं. / Contact No.</span>
        <UnderlineInput id="contactNo" width="w-40" />
        <span>पिन / PIN:</span>
        <UnderlineInput id="pin" width="w-24" />
      </div>
    </td>
  </tr>
);

const LetterPage = ({
  signatureCapture,
  fromDate,
  toDate,
  computedDays,
}: {
  signatureCapture?: { image?: string } | null;
  fromDate?: string;
  toDate?: string;
  computedDays?: string;
}) => (
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
        I wish to proceed abroad to <UnderlineInput id="country" width="w-64" />{" "}
        (Country) for the following purpose:-
      </p>
      <p className="mt-3">
        <UnderlineInput id="purposeOfVisit" width="w-full" />
      </p>

      <p className="mt-3">
        I request that I may kindly be granted leave of the due / leave without
        pay Ex-India for
        <UnderlineInput
          id="exDays"
          width="w-20"
          defaultValue={computedDays}
        />{" "}
        days from{" "}
        <UnderlineInput id="exFrom" width="w-32" defaultValue={fromDate} /> to{" "}
        <UnderlineInput id="exTo" width="w-32" defaultValue={toDate} />. I am
        holding a valid passport for visit to the aforesaid country / countries.
      </p>

      <p className="mt-3">
        During my stay in the above country / countries, my address will be as
        under:-
      </p>
      <div className="space-y-2 pt-2">
        <UnderlineInput id="addr1" className="w-full" />
        <UnderlineInput id="addr2" className="w-full" />
        <UnderlineInput id="addr3" className="w-full" />
      </div>

      <p className="mt-4">I hereby undertake that:-</p>
      <ol className="ml-6 mt-2 list-decimal space-y-1">
        <li>
          I shall return to duty on expiry of the aforesaid leave and shall not
          extend leave.
        </li>
        <li>I shall intimate change in my above address, if any.</li>
        <li>
          I shall not undertake any employment abroad during the period of my
          leave / stay / abroad.
        </li>
        <li>
          I shall not leave the station / country unless the sanction has been
          communicated to me.
        </li>
        <li>
          I am submitting an undertaking on the prescribed form as per rules
          duly signed.
        </li>
      </ol>

      <div className="mt-5 text-right space-y-3 sm:mt-6 sm:space-y-4">
        <p>Yours faithfully,</p>
        <div className="space-y-2">
          <p>
            Signature{" "}
            {signatureCapture?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signatureCapture.image}
                alt="letter-signature"
                className="inline-block h-14 ml-2"
              />
            ) : (
              <UnderlineInput
                id="letterSignature"
                width="w-56"
                className="ml-2"
              />
            )}
          </p>
          <p>
            Name{" "}
            <UnderlineInput id="letterName" width="w-64" className="ml-2" />
          </p>
          <p>
            Designation{" "}
            <UnderlineInput
              id="letterDesignation"
              width="w-60"
              className="ml-2"
            />
          </p>
          <p>
            Department{" "}
            <UnderlineInput
              id="letterDepartment"
              width="w-60"
              className="ml-2"
            />
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2 text-[12px] text-slate-900 sm:mt-6 sm:text-[13px]">
        <p>
          Dated: <UnderlineInput id="letterDated" width="w-40" />
        </p>
        <p>Recommendations of the Head of the Department</p>
      </div>
    </div>
  </SurfaceCard>
);

const UndertakingFormOne = ({
  applicationDetails,
  formData,
  applicantProfile,
  witness1Id,
  witness2Id,
  witness1Query,
  witness2Query,
  onWitness1QueryChange,
  onWitness2QueryChange,
  isSearchingWitness1,
  isSearchingWitness2,
  witness1Results,
  witness2Results,
  applicantEmail,
  witnessRequestTimes,
  witness1Profile,
  witness2Profile,
  signatureCapture,
  nowMs,
  onSelect,
  applicationId,
  onWitnessRequestSent,
  onCreateWitnessApplication,
}: {
  applicationDetails?: ExIndiaApplicationDetails | null;
  formData?: Record<string, string>;
  applicantProfile?: AutofillProfile | null;
  witness1Id: string | null;
  witness2Id: string | null;
  witness1Query: string;
  witness2Query: string;
  onWitness1QueryChange: (value: string) => void;
  onWitness2QueryChange: (value: string) => void;
  isSearchingWitness1: boolean;
  isSearchingWitness2: boolean;
  witness1Results: WitnessSearchResult[];
  witness2Results: WitnessSearchResult[];
  applicantEmail: string;
  witnessRequestTimes: Record<1 | 2, string | null>;
  witness1Profile?: WitnessSearchResult | null;
  witness2Profile?: WitnessSearchResult | null;
  signatureCapture?: { image?: string } | null;
  nowMs: number;
  onSelect: (slot: 1 | 2, id: string | null) => void | Promise<void>;
  applicationId?: string | null;
  onWitnessRequestSent: (slot: 1 | 2, timestamp: string) => void;
  onCreateWitnessApplication: (slot: 1 | 2) => Promise<string | null>;
}) => {
  const [selectedWitnessSlot, setSelectedWitnessSlot] = useState<1 | 2>(1);
  const w1 = applicationDetails?.approvalSteps?.find(
    (step) => isWitnessStep(step) && step.sequence === 1,
  );
  const w2 = applicationDetails?.approvalSteps?.find(
    (step) => isWitnessStep(step) && step.sequence === 2,
  );
  const applicantDesignation =
    formData?.post ?? formData?.designation ?? applicantProfile?.designation;
  const applicantDepartment =
    formData?.department ?? applicantProfile?.department;
  const applicantEmployeeCode =
    formData?.employeeCode ?? applicantProfile?.employeeCode;
  const witnessSlotData = {
    1: {
      name: w1?.assignedTo?.name ?? witness1Profile?.name,
      employeeCode:
        w1?.assignedTo?.employeeCode ?? witness1Profile?.employeeCode,
      department:
        w1?.assignedTo?.department?.name ?? witness1Profile?.department,
      signature: w1?.metadata?.approverSignatureProof?.image,
    },
    2: {
      name: w2?.assignedTo?.name ?? witness2Profile?.name,
      employeeCode:
        w2?.assignedTo?.employeeCode ?? witness2Profile?.employeeCode,
      department:
        w2?.assignedTo?.department?.name ?? witness2Profile?.department,
      signature: w2?.metadata?.approverSignatureProof?.image,
    },
  } as const;

  const activeWitnessSlot =
    witnessSlotData[selectedWitnessSlot].name || !witnessSlotData[2].name
      ? selectedWitnessSlot
      : 2;
  const todayIso = getTodayIso();
  const w1RequestTime = witnessRequestTimes[1]
    ? new Date(witnessRequestTimes[1] as string).getTime()
    : null;
  const w2RequestTime = witnessRequestTimes[2]
    ? new Date(witnessRequestTimes[2] as string).getTime()
    : null;
  const w1RemindAt = w1RequestTime ? w1RequestTime + 60 * 60 * 1000 : null;
  const w2RemindAt = w2RequestTime ? w2RequestTime + 60 * 60 * 1000 : null;
  const canRemindW1 = w1RemindAt ? nowMs >= w1RemindAt : false;
  const canRemindW2 = w2RemindAt ? nowMs >= w2RemindAt : false;
  const minutesRemainingW1 = w1RemindAt
    ? Math.max(0, Math.ceil((w1RemindAt - nowMs) / 60000))
    : null;
  const minutesRemainingW2 = w2RemindAt
    ? Math.max(0, Math.ceil((w2RemindAt - nowMs) / 60000))
    : null;

  const filteredWitness1Results = witness1Results.filter(
    (r) => r.id !== witness2Id && r.email !== applicantEmail,
  );
  const filteredWitness2Results = witness2Results.filter(
    (r) => r.id !== witness1Id && r.email !== applicantEmail,
  );

  return (
    <SurfaceCard className="mx-auto max-w-4xl space-y-4 border border-slate-300 bg-white p-3 sm:space-y-6 sm:p-4 md:p-6">
      <div className="flex justify-end text-[13px] font-semibold text-slate-900">
        Form - I
      </div>
      <div className="space-y-2 text-center text-[13px] text-slate-900">
        <p className="font-semibold underline">UNDERTAKING</p>
      </div>
      <div className="space-y-3 text-[12px] text-slate-900 sm:space-y-4 sm:text-[13px]">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-slate-900">
              Witness selection
            </p>
            {isSearchingWitness1 || isSearchingWitness2 ? (
              <span className="text-xs text-slate-500">Searching...</span>
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
              <label className="text-xs font-semibold text-slate-700">
                Witness 1
              </label>
              <input
                type="text"
                placeholder="Search by name or email"
                value={witness1Query}
                onChange={(event) => onWitness1QueryChange(event.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
              />
              <select
                value={witness1Id ?? ""}
                onChange={(event) => onSelect(1, event.target.value || null)}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                <option value="">-- Select --</option>
                {filteredWitness1Results.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.designation ? `(${r.designation})` : ""}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${witnessStatusClass(w1)}`}
                >
                  {formatWitnessStatus(w1)}
                </span>
                {w1?.actedAt ? (
                  <span>
                    Updated {new Date(w1.actedAt).toLocaleString("en-GB")}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={async () => {
                    if (!applicationId) {
                      await onCreateWitnessApplication(1);
                      return;
                    }
                    if (!witness1Id) {
                      window.alert("Select Witness 1 before sending.");
                      return;
                    }
                    try {
                      await fetch("/api/ex-india-leave/send-witness-request", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          applicationId,
                          witnessId: witness1Id,
                          sequence: 1,
                        }),
                      });
                      onWitnessRequestSent(1, new Date().toISOString());
                      window.alert("Witness 1 notified.");
                    } catch (err) {
                      console.error(err);
                      window.alert("Unable to notify Witness 1.");
                    }
                  }}
                >
                  Send to witness 1
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={!applicationId || !witness1Id || !canRemindW1}
                  onClick={async () => {
                    if (!applicationId || !witness1Id) return;
                    if (!canRemindW1) return;
                    try {
                      await fetch("/api/ex-india-leave/send-witness-request", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          applicationId,
                          witnessId: witness1Id,
                          sequence: 1,
                          remindMinutes: 60,
                        }),
                      });
                      onWitnessRequestSent(1, new Date().toISOString());
                      window.alert("Witness 1 reminded.");
                    } catch (err) {
                      console.error(err);
                      window.alert("Unable to schedule reminder.");
                    }
                  }}
                >
                  Remind
                </Button>
                {applicationId &&
                !canRemindW1 &&
                minutesRemainingW1 !== null ? (
                  <span className="text-xs text-slate-600">
                    Remind in {minutesRemainingW1} min
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
              <label className="text-xs font-semibold text-slate-700">
                Witness 2
              </label>
              <input
                type="text"
                placeholder="Search by name or email"
                value={witness2Query}
                onChange={(event) => onWitness2QueryChange(event.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
              />
              <select
                value={witness2Id ?? ""}
                onChange={(event) => onSelect(2, event.target.value || null)}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                <option value="">-- Select --</option>
                {filteredWitness2Results.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.designation ? `(${r.designation})` : ""}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${witnessStatusClass(w2)}`}
                >
                  {formatWitnessStatus(w2)}
                </span>
                {w2?.actedAt ? (
                  <span>
                    Updated {new Date(w2.actedAt).toLocaleString("en-GB")}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={async () => {
                    if (!applicationId) {
                      await onCreateWitnessApplication(2);
                      return;
                    }
                    if (!witness2Id) {
                      window.alert("Select Witness 2 before sending.");
                      return;
                    }
                    try {
                      await fetch("/api/ex-india-leave/send-witness-request", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          applicationId,
                          witnessId: witness2Id,
                          sequence: 2,
                        }),
                      });
                      onWitnessRequestSent(2, new Date().toISOString());
                      window.alert("Witness 2 notified.");
                    } catch (err) {
                      console.error(err);
                      window.alert("Unable to notify Witness 2.");
                    }
                  }}
                >
                  Send to witness 2
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={!applicationId || !witness2Id || !canRemindW2}
                  onClick={async () => {
                    if (!applicationId || !witness2Id) return;
                    if (!canRemindW2) return;
                    try {
                      await fetch("/api/ex-india-leave/send-witness-request", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          applicationId,
                          witnessId: witness2Id,
                          sequence: 2,
                          remindMinutes: 60,
                        }),
                      });
                      onWitnessRequestSent(2, new Date().toISOString());
                      window.alert("Witness 2 reminded.");
                    } catch (err) {
                      console.error(err);
                      window.alert("Unable to schedule reminder.");
                    }
                  }}
                >
                  Remind
                </Button>
                {applicationId &&
                !canRemindW2 &&
                minutesRemainingW2 !== null ? (
                  <span className="text-xs text-slate-600">
                    Remind in {minutesRemainingW2} min
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <p>
          I,{" "}
          <UnderlineInput
            id="u1Name"
            width="w-60"
            defaultValue={formData?.name ?? undefined}
          />
          ,{" "}
          <UnderlineInput
            id="u1Designation"
            width="w-60"
            defaultValue={applicantDesignation ?? undefined}
          />{" "}
          (Designation) is proceeding on Ex-India Leave (EL) to
          <UnderlineInput
            id="u1Country"
            width="w-60"
            defaultValue={formData?.country ?? undefined}
          />{" "}
          (Country) for{" "}
          <UnderlineInput
            id="u1Days"
            width="w-20"
            defaultValue={formData?.days ?? undefined}
          />{" "}
          days from
          <UnderlineInput
            id="u1From"
            width="w-32"
            defaultValue={formData?.fromDate ?? undefined}
          />{" "}
          to{" "}
          <UnderlineInput
            id="u1To"
            width="w-32"
            defaultValue={formData?.toDate ?? undefined}
          />
          .
        </p>
        <p>
          I hereby certify that no Institute dues are outstanding against me.
          Further I undertake that if I did not return back on the due date i.e.{" "}
          <UnderlineInput
            id="u1DueDate"
            width="w-32"
            defaultValue={formData?.toDate ?? undefined}
          />
          , any dues of the Institute found later on, the same may be recovered
          from my payable balances available with the Institute.
        </p>
        <p>
          Date:{" "}
          <UnderlineInput id="u1Date" width="w-32" defaultValue={todayIso} />
        </p>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2 text-[13px] text-slate-900">
            <p className="font-semibold">Witness</p>
            {(witnessSlotData[1].name || witnessSlotData[2].name) && (
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span>Use witness</span>
                <select
                  value={selectedWitnessSlot}
                  onChange={(event) =>
                    setSelectedWitnessSlot(event.target.value === "2" ? 2 : 1)
                  }
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]"
                >
                  {witnessSlotData[1].name ? (
                    <option value={1}>
                      Witness 1 - {witnessSlotData[1].name}
                    </option>
                  ) : null}
                  {witnessSlotData[2].name ? (
                    <option value={2}>
                      Witness 2 - {witnessSlotData[2].name}
                    </option>
                  ) : null}
                </select>
              </div>
            )}
            <p>
              Signature{" "}
              {witnessSlotData[activeWitnessSlot].signature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={witnessSlotData[activeWitnessSlot].signature}
                  alt="witness-sign"
                  className="inline-block h-14"
                />
              ) : (
                <UnderlineInput
                  id="u1WitnessSign"
                  width="w-48"
                  className="ml-2"
                />
              )}
            </p>
            <p>
              Name{" "}
              <UnderlineInput
                id="u1WitnessName"
                width="w-48"
                className="ml-2"
                value={witnessSlotData[activeWitnessSlot].name ?? ""}
                readOnly
              />
            </p>
            <p>
              E. Code No.{" "}
              <UnderlineInput
                id="u1WitnessCode"
                width="w-40"
                className="ml-2"
                value={witnessSlotData[activeWitnessSlot].employeeCode ?? ""}
                readOnly
              />
            </p>
            <p>
              Department{" "}
              <UnderlineInput
                id="u1WitnessDept"
                width="w-48"
                className="ml-2"
                value={witnessSlotData[activeWitnessSlot].department ?? ""}
                readOnly
              />
            </p>
          </div>
          <div className="space-y-2 text-right text-[13px] text-slate-900">
            <p>
              Signature{" "}
              {signatureCapture?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signatureCapture.image}
                  alt="applicant-sign"
                  className="inline-block h-14 ml-2"
                />
              ) : (
                <UnderlineInput id="u1Sign" width="w-48" className="ml-2" />
              )}
            </p>
            <p>
              Name:{" "}
              <UnderlineInput
                id="u1SignName"
                width="w-48"
                className="ml-2"
                defaultValue={formData?.name ?? undefined}
              />
            </p>
            <p>
              Employee Code:{" "}
              <UnderlineInput
                id="u1SignCode"
                width="w-40"
                className="ml-2"
                defaultValue={applicantEmployeeCode ?? undefined}
              />
            </p>
            <p>
              Department:{" "}
              <UnderlineInput
                id="u1SignDept"
                width="w-48"
                className="ml-2"
                defaultValue={applicantDepartment ?? undefined}
              />
            </p>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
};

const UndertakingFormTwo = ({
  applicationDetails,
  formData,
  witness1Profile,
  witness2Profile,
  applicantProfile,
  signatureCapture,
}: {
  applicationDetails?: ExIndiaApplicationDetails | null;
  formData?: Record<string, string>;
  witness1Profile?: WitnessSearchResult | null;
  witness2Profile?: WitnessSearchResult | null;
  applicantProfile?: AutofillProfile | null;
  signatureCapture?: { image?: string } | null;
}) => {
  const todayIso = getTodayIso();
  const w1 = applicationDetails?.approvalSteps?.find(
    (step) => isWitnessStep(step) && step.sequence === 1,
  );
  const w2 = applicationDetails?.approvalSteps?.find(
    (step) => isWitnessStep(step) && step.sequence === 2,
  );
  const witness1Name = w1?.assignedTo?.name ?? witness1Profile?.name;
  const witness2Name = w2?.assignedTo?.name ?? witness2Profile?.name;
  const witness1Designation =
    w1?.assignedTo?.designation ?? witness1Profile?.designation;
  const witness2Designation =
    w2?.assignedTo?.designation ?? witness2Profile?.designation;
  const applicantDesignation =
    formData?.post ?? formData?.designation ?? applicantProfile?.designation;
  const applicantDepartment =
    formData?.department ?? applicantProfile?.department;

  return (
    <SurfaceCard className="mx-auto max-w-4xl space-y-4 border border-slate-300 bg-white p-3 sm:space-y-6 sm:p-4 md:p-6">
      <div className="flex justify-end text-[13px] font-semibold text-slate-900">
        Form - II
      </div>
      <div className="space-y-2 text-center text-[13px] text-slate-900">
        <p className="font-semibold underline">
          UNDERTAKING/ AGREEMENT FROM A MEMBER OF STAFF OF IIT ROPAR PROCEEDING
          ON LEAVE EX-INDIA
        </p>
      </div>
      <div className="space-y-4 text-[13px] text-slate-900">
        <p>
          Whereas, I,{" "}
          <UnderlineInput
            id="u2Name"
            width="w-60"
            defaultValue={formData?.name ?? undefined}
          />{" "}
          employed as Designation{" "}
          <UnderlineInput
            id="u2Designation"
            width="w-60"
            defaultValue={applicantDesignation}
          />{" "}
          in the{" "}
          <UnderlineInput
            id="u2Dept"
            width="w-60"
            defaultValue={formData?.department ?? undefined}
          />{" "}
          on Indian Institute of Technology, Ropar have applied for leave
          Ex-India for the period from{" "}
          <UnderlineInput
            id="u2From"
            width="w-32"
            defaultValue={formData?.fromDate ?? undefined}
          />{" "}
          to{" "}
          <UnderlineInput
            id="u2To"
            width="w-32"
            defaultValue={formData?.toDate ?? undefined}
          />{" "}
          for private work.
        </p>
        <p>
          And whereas Indian Institute of Technology, Ropar have agreed to grant
          me leave Ex-India Leave of the kind due for period from{" "}
          <UnderlineInput
            id="u2LeaveFrom"
            width="w-32"
            defaultValue={formData?.fromDate ?? undefined}
          />{" "}
          to{" "}
          <UnderlineInput
            id="u2LeaveTo"
            width="w-32"
            defaultValue={formData?.toDate ?? undefined}
          />{" "}
          on the condition that no extension of the said leave shall be allowed
          but the Institute may in special circumstances, on my request, extend
          the leave for such period as it may deem fit and if I fail to return
          to duty at the Institute on the expire of the aforesaid leave of such
          extended period of leave as the Institute may be pleased to extend. I
          shall be deemed to have resigned from my post at the Institute with
          effect from the day immediately next to the date of on which the said
          leave expires.
        </p>
        <p>
          Now, therefore, I hereby declare and agree that the grant of leave on
          the condition mentioned above is acceptable to me and I hereby
          undertake and agree to abide by the same and that in the event of my
          failure to return to the Institute on the expire of the above said
          leave or the extended period of leave. I shall be deemed to have
          resigned from the Institute post and my relation with the Institute as
          employee and employer shall cease immediately.
        </p>

        <div className="flex flex-wrap items-start justify-between gap-6 pt-4">
          <div className="space-y-2 text-[13px] text-slate-900">
            <p>
              Signature{" "}
              {signatureCapture?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signatureCapture.image}
                  alt="applicant-sign"
                  className="ml-2 inline-block h-14"
                />
              ) : (
                <UnderlineInput id="u2Sign" width="w-48" className="ml-2" />
              )}
            </p>
            <p>
              Name{" "}
              <UnderlineInput
                id="u2SignName"
                width="w-48"
                className="ml-2"
                defaultValue={formData?.name ?? undefined}
              />
            </p>
            <p>
              Department{" "}
              <UnderlineInput
                id="u2SignDept"
                width="w-48"
                className="ml-2"
                defaultValue={applicantDepartment ?? undefined}
              />
            </p>
            <p>
              Designation{" "}
              <UnderlineInput
                id="u2SignDesignation"
                width="w-48"
                className="ml-2"
                defaultValue={applicantDesignation}
              />
            </p>
          </div>

          <div className="space-y-2 text-[13px] text-slate-900">
            <p className="font-semibold">Signed in the presence of:</p>
            <div className="flex flex-wrap items-center gap-2">
              <span>Signature</span>
              {w1?.metadata?.approverSignatureProof?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={w1.metadata.approverSignatureProof.image}
                  alt="w2-witness1-sign"
                  className="inline-block h-14"
                />
              ) : (
                <UnderlineInput id="u2Witness1Sign" width="w-44" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Name</span>
              <UnderlineInput
                id="u2Witness1Name"
                width="w-44"
                defaultValue={witness1Name ?? undefined}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Designation</span>
              <UnderlineInput
                id="u2Witness1Designation"
                width="w-44"
                defaultValue={witness1Designation ?? undefined}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Date</span>
              <UnderlineInput
                id="u2Witness1Date"
                width="w-36"
                defaultValue={todayIso}
              />
            </div>
          </div>

          <div className="space-y-2 text-[13px] text-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <span>Signature</span>
              {w2?.metadata?.approverSignatureProof?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={w2.metadata.approverSignatureProof.image}
                  alt="w2-witness2-sign"
                  className="inline-block h-14"
                />
              ) : (
                <UnderlineInput id="u2Witness2Sign" width="w-44" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Name</span>
              <UnderlineInput
                id="u2Witness2Name"
                width="w-44"
                defaultValue={witness2Name ?? undefined}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Designation</span>
              <UnderlineInput
                id="u2Witness2Designation"
                width="w-44"
                defaultValue={witness2Designation ?? undefined}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Date</span>
              <UnderlineInput
                id="u2Witness2Date"
                width="w-36"
                defaultValue={todayIso}
              />
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
};
