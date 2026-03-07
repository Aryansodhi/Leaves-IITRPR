"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useRef, useState, forwardRef } from "react";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { applyAutofillToForm, saveFormDraft } from "@/lib/form-autofill";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;

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
  "days",
  "from",
  "to",
  "nature",
  "purpose",
  "contactPrefix",
  "contactNumber",
  "contactAddress",
  "place",
  "date",
  "applicantSign",
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

    saveFormDraft("station-leave", data);
    const missing = requiredInputIds.filter((key) => !data[key]?.trim());
    const invalid = new Set<string>();

    if (!/^\d+$/.test(data.days ?? "") || Number.parseInt(data.days, 10) < 1) {
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

    const flaggedFields = new Set([...missing, ...invalid]);
    markMissingInputs(form, flaggedFields);

    if (flaggedFields.size > 0) {
      setMissingFields(Array.from(flaggedFields));
      if (invalid.has("days")) {
        setSubmitError("No. of days must be a whole number greater than 0.");
      } else if (invalid.has("contactNumber")) {
        setSubmitError("Phone number must contain exactly 10 digits.");
      } else if (invalid.has("from") || invalid.has("to")) {
        setSubmitError(
          "The To date must be the same as or later than the From date.",
        );
      }
      return;
    }

    setMissingFields([]);
    setSubmitError(null);
    pendingDataRef.current = data;
    setDialogState("confirm");
  };

  const handleConfirmSubmit = async () => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/station-leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ form: pendingDataRef.current }),
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
  };

  const handleDownloadPdf = async () => {
    const form = formRef.current;
    if (!form) return;
    setIsDownloading(true);
    try {
      await generatePdfFromForm(form, "Station Leave");
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
      void applyAutofillToForm(form, "station-leave");
    }

    void loadBootstrap();
  }, []);

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
          <SurfaceCard className="mx-auto max-w-3xl space-y-5 border border-slate-300 bg-white p-6 md:p-7">
            <header className="space-y-1 text-center text-slate-900">
              <div className="flex items-start justify-center gap-4">
                <Image
                  src="/iit_ropar.png"
                  alt="IIT Ropar"
                  width={64}
                  height={64}
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
              <LineItem number="2." label="Designation" inputId="designation" />
              <LineItem number="3." label="Department" inputId="department" />
              <StationLeaveDatesRow />
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
                <UnderlineInput id="applicantSign" width="w-64" />
              </div>
            </div>
          </SurfaceCard>

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

const generatePdfFromForm = async (element: HTMLElement, title: string) => {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    onclone: (doc) => {
      const containsUnsupported = (val?: string | null) =>
        Boolean(val && /(oklab|oklch|\slab\s*\()/i.test(val));
      const safeBorder = "rgba(15, 23, 42, 0.2)";
      const safeInk = "#0f172a";

      doc.querySelectorAll("style").forEach((styleTag) => {
        if (containsUnsupported(styleTag.textContent)) {
          styleTag.remove();
        }
      });

      const resetStyle = doc.createElement("style");
      resetStyle.textContent = `
        * { color: ${safeInk} !important; background: #ffffff !important; background-image: none !important; box-shadow: none !important; text-shadow: none !important; filter: none !important; }
        * { border-color: ${safeBorder} !important; outline-color: ${safeInk} !important; }
        svg *, path, line, rect, circle { fill: ${safeInk} !important; stroke: ${safeInk} !important; }
      `;
      doc.head.appendChild(resetStyle);

      doc.body.style.background = "#ffffff";
      doc.body.style.backgroundImage = "none";

      doc.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const style = doc.defaultView?.getComputedStyle(el);
        if (!style) return;

        if (containsUnsupported(style.color)) el.style.color = safeInk;

        if (
          containsUnsupported(style.backgroundColor) ||
          containsUnsupported(style.backgroundImage)
        ) {
          el.style.backgroundColor = "#ffffff";
          el.style.backgroundImage = "none";
        }

        [
          "borderColor",
          "borderTopColor",
          "borderRightColor",
          "borderBottomColor",
          "borderLeftColor",
        ].forEach((prop) => {
          const val = (style as unknown as Record<string, string>)[prop];
          if (containsUnsupported(val)) {
            (el.style as unknown as Record<string, string>)[prop] = safeBorder;
          }
        });

        if (containsUnsupported(style.outlineColor)) {
          el.style.outlineColor = safeInk;
        }

        if (containsUnsupported(style.boxShadow)) {
          el.style.boxShadow = "none";
        }

        if (containsUnsupported(style.textShadow)) {
          el.style.textShadow = "none";
        }

        if (containsUnsupported(style.fill)) {
          el.style.fill = safeInk;
        }

        if (containsUnsupported(style.stroke)) {
          el.style.stroke = safeInk;
        }
      });
    },
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "pt", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  while (heightLeft > 0) {
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    if (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
    }
  }

  const safeName = title.replace(/\s+/g, "-").toLowerCase();
  pdf.save(`${safeName}.pdf`);
};

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
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
              <li>I confirm the information provided is accurate.</li>
              <li>I acknowledge the submission will be routed for review.</li>
              <li>I understand I may be contacted for clarifications.</li>
            </ul>
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

const StationLeaveDatesRow = () => (
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
        <DateUnderlineInput id="from" />
      </div>
      <div className="flex items-center gap-2">
        <span>To</span>
        <DateUnderlineInput id="to" />
      </div>
      <div className="flex items-center gap-2">
        <span>No. of days</span>
        <NumberStepperInput id="days" />
      </div>
    </div>
  </div>
);

const DateUnderlineInput = ({ id }: { id: string }) => (
  <UnderlineInput id={id} type="date" width="w-40" className="scheme-light" />
);

const NumberStepperInput = ({ id }: { id: string }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const updateValue = (direction: "up" | "down") => {
    const input = inputRef.current;
    if (!input) return;

    if (direction === "up") {
      input.stepUp();
    } else if (Number.parseInt(input.value || "1", 10) > 1) {
      input.stepDown();
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-300 px-1 py-0.5">
      <button
        type="button"
        onClick={() => updateValue("down")}
        className="rounded-full p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label="Decrease number of days"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <UnderlineInput
        ref={inputRef}
        id={id}
        type="number"
        min={1}
        step={1}
        defaultValue="1"
        inputMode="numeric"
        width="w-14"
        className="text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => updateValue("up")}
        className="rounded-full p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label="Increase number of days"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

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
