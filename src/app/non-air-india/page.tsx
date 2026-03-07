"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  applyAutofillToForm,
  saveFormDraft,
  clearFormDraft,
} from "@/lib/form-autofill";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;

interface UnderlineInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  id: string;
  width?: string;
  type?: "text" | "number" | "date" | "email";
}

const UnderlineInput = ({
  id,
  width = "w-60",
  className,
  type = "text",
  required = true,
  ...props
}: UnderlineInputProps) => (
  <input
    id={id}
    name={id}
    type={type}
    required={required}
    className={cn(
      "border-0 border-b border-dashed border-slate-500 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
    {...props}
  />
);

export default function NonAirIndiaPage() {
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

  const markMissingInputs = (form: HTMLFormElement, missing: Set<string>) => {
    const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input"));
    inputs.forEach((input) => {
      if (!input.required) return;
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
    saveFormDraft("non-air-india", data);

    // Check missing for only required fields
    const required = Array.from(
      form.querySelectorAll<HTMLInputElement>("input[required]"),
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

    setMissingFields([]);
    pendingDataRef.current = data;
    setDialogState("confirm");
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    void applyAutofillToForm(form, "non-air-india");
  }, []);

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/non-air-india", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: pendingDataRef.current }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Submission failed");
      }

      setConfirmed(true);
      setDialogState("success");

      // CLEAR DRAFT AFTER SUCCESS
      clearFormDraft("non-air-india");
      if (formRef.current) {
        formRef.current.reset(); // Empty the form visually
        // Re-apply basic profile info (Name, Designation, Dept) so it's ready for next time
        void applyAutofillToForm(formRef.current, "non-air-india");
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Submission failed");
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
      await generatePdfFromForm(form, "Non-Air-India Travel");
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <DashboardShell>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="px-0 text-sm font-semibold text-slate-700"
          type="button"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

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
                  नंगल मार्ग, रूपनगर,पंजाब-140001/Nangal Road, Rupnagar,
                  Punjab-140001
                </p>
                <p className="text-[11px] text-slate-700">
                  दूरभाष/Tele: +91-1881-227078,फैक्स /Fax : +91-1881-223395
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold uppercase">
              APPLICATION FOR PERMISSION TO TRAVEL BY AIRLINE OTHER THAN AIR
              INDIA
            </p>
          </header>

          <div className="space-y-3 text-[13px] text-slate-900">
            <LabeledLine number="1" label="Name" inputId="name" />
            <LabeledLine number="2" label="Designation" inputId="designation" />
            <LabeledLine number="3" label="Department" inputId="department" />
            <VisitDates />
            <LabeledLine
              number="5"
              label="Place to be Visited"
              inputId="placeToVisit"
            />
            <LabeledLine number="6" label="Purpose" inputId="purpose" />
            <LabeledLine
              number="7"
              label="Sectors for which permission is sought"
              inputId="sectors"
            />
            <LabeledLine
              number="8"
              label="Reason for travel by airline other than Air India"
              inputId="reason"
            />
            <PermissionMhrd />
            <LabeledLine
              number="10"
              label="Budget Head: Institute/Project"
              inputId="budgetHead"
            />
          </div>

          <p className="text-[12px] text-slate-900">
            May kindly consider and grant permission to travel by Airline other
            than AirIndia as a special case as justified at Sr. No. 8 above.
          </p>

          <div className="flex items-center justify-end text-[12px] text-slate-900">
            <span>(Signature of Applicant’s with date)</span>
            <UnderlineInput
              id="applicantSignature"
              width="w-64"
              className="ml-2"
              placeholder="Full Name as Signature"
            />
          </div>

          <div className="space-y-2 text-[12px] text-slate-900">
            <p>Recommendation of the HoD</p>
            <p>Dean (Faculty Affairs and Administration)</p>
            <p>Director</p>
          </div>
        </SurfaceCard>

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

        <ConfirmationModal
          state={dialogState}
          title="Non-Air-India Travel"
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
              ? `${title} request has been submitted successfully. You may close this window.`
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

const LabeledLine = ({
  number,
  label,
  inputId,
  type = "text",
}: {
  number: string;
  label: string;
  inputId: string;
  type?: "text" | "number" | "date";
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="w-4 text-right font-semibold">{number}</span>
    <span className="flex-1 font-semibold">{label}</span>
    <span>:</span>
    <UnderlineInput id={inputId} type={type} className="flex-1" />
  </div>
);

const VisitDates = () => (
  <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-4 text-right font-semibold">4</span>
      <span className="flex-1 font-semibold">Visit Dates</span>
      <span>:</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-xs">Onward Journey:</span>
        <UnderlineInput id="onwardJourney" type="date" width="w-36" />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-xs">Return Journey:</span>
        <UnderlineInput id="returnJourney" type="date" width="w-36" />
      </div>
    </div>
  </div>
);

const PermissionMhrd = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="w-4 text-right font-semibold">9</span>
    <span className="flex-1 font-semibold">Permission sought from MHRD.</span>
    <span>:</span>
    <span>Yes/No (If yes mail attached):</span>
    <UnderlineInput id="permissionMhrd" width="w-28" />
  </div>
);
