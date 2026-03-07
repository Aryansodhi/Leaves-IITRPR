"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { applyAutofillToForm, saveFormDraft } from "@/lib/form-autofill";
import { downloadFormAsPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;

const UnderlineInput = ({
  id,
  width = "w-48",
  className,
}: {
  id: string;
  width?: string;
  className?: string;
}) => (
  <input
    id={id}
    name={id}
    type="text"
    className={cn(
      "border-0 border-b border-dashed border-slate-500 bg-transparent px-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
  />
);

const pages = ["LTC form", "Office sections"] as const;

export default function LtcPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [page, setPage] = useState(0);
  const isLastPage = page === pages.length - 1;
  const formRef = useRef<HTMLFormElement>(null);
  const pendingDataRef = useRef<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const next = () => setPage((p) => Math.min(p + 1, pages.length - 1));
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
    saveFormDraft("ltc", data);
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

    setMissingFields([]);
    pendingDataRef.current = data;
    setDialogState("confirm");
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    void applyAutofillToForm(form, "ltc");
  }, []);

  const handleConfirmSubmit = () => {
    setConfirmed(true);
    setDialogState("success");
    console.log("LTC form submitted", pendingDataRef.current);
  };

  const handleCloseDialog = () => {
    setDialogState(null);
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

  const pageLabel = useMemo(() => `${pages[page]} (${page + 1}/2)`, [page]);
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

        {page === 0 && <LtcFormPage />}
        {page === 1 && <OfficeSectionsPage />}

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
            >
              {isLastPage ? "Submit" : "Next"}
              {!isLastPage && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          {confirmed
            ? "Submission confirmed. You can still edit and resubmit if needed."
            : missingFields.length > 0
              ? "Please fill the highlighted fields."
              : "Fill all fields, then submit."}
        </div>

        <ConfirmationModal
          state={dialogState}
          title="LTC"
          onCancel={handleCloseDialog}
          onConfirm={handleConfirmSubmit}
          onDownload={handleDownloadPdf}
          isDownloading={isDownloading}
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

const LtcFormPage = () => (
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
          <RowLeaveRequired />
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
    <Undertaking />
  </SurfaceCard>
);

const OfficeSectionsPage = () => (
  <SurfaceCard className="mx-auto max-w-5xl space-y-6 border border-slate-300 bg-white p-4 md:p-6">
    <EstablishmentSection />
    <AccountsSection />
    <AuditSection />
  </SurfaceCard>
);

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

const RowLeaveRequired = () => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">5.</td>
    <td className="px-3 py-2">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Leave required</span>
          <span>Nature:</span>
          <UnderlineInput id="leaveNature" width="w-32" />
          <span>From</span>
          <UnderlineInput id="leaveFrom" width="w-32" />
          <span>To</span>
          <UnderlineInput id="leaveTo" width="w-32" />
          <span>No. of days</span>
          <UnderlineInput id="leaveDays" width="w-20" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span>Prefix: From</span>
          <UnderlineInput id="prefixFrom" width="w-32" />
          <span>To</span>
          <UnderlineInput id="prefixTo" width="w-32" />
          <span>&amp; Suffix: From</span>
          <UnderlineInput id="suffixFrom" width="w-32" />
          <span>To</span>
          <UnderlineInput id="suffixTo" width="w-32" />
        </div>
      </div>
    </td>
  </tr>
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
                <UnderlineInput id="selfOutward" className="w-full" />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput id="selfInward" className="w-full" />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                Family
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput id="familyOutward" className="w-full" />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput id="familyInward" className="w-full" />
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
        <UnderlineInput id="advanceRequired" width="w-24" />
        <span>Yes / No</span>
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
        <UnderlineInput id="encashmentRequired" width="w-24" />
        <span>Yes/No</span>
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

const Undertaking = () => (
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
        <UnderlineInput id="applicantSignature" width="w-56" />
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between text-[12px]">
      <span>Head/Section Incharge</span>
      <span className="mr-20">&nbsp;</span>
    </div>
  </div>
);

const EstablishmentSection = () => (
  <div className="space-y-3 text-[12px] text-slate-900">
    <div className="text-center font-semibold">
      (A) FOR USE OF ESTABLISHMENT SECTION
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <span>
        Fresh Recruit i.e. joining Govt. Service after 01.09.2008 /otherwise,
        Date of joining:
      </span>
      <UnderlineInput id="freshRecruitDate" width="w-40" />
      <span>Block year:</span>
      <UnderlineInput id="estBlockYear" width="w-28" />
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
              <UnderlineInput id="estNatureLast" className="w-full" />
            </td>
            <td className="border border-slate-400 px-2 py-1">
              <UnderlineInput id="estNatureCurrent" className="w-full" />
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
              <UnderlineInput id="estPeriodLast" className="w-full" />
            </td>
            <td className="border border-slate-400 px-2 py-1">
              <UnderlineInput id="estPeriodCurrent" className="w-full" />
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
              <UnderlineInput id="estSelfFamilyLast" className="w-full" />
            </td>
            <td className="border border-slate-400 px-2 py-1">
              <UnderlineInput id="estSelfFamilyCurrent" className="w-full" />
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
              <UnderlineInput id="estEncashLast" className="w-full" />
            </td>
            <td className="border border-slate-400 px-2 py-1">
              <UnderlineInput id="estEncashCurrent" className="w-full" />
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
              <UnderlineInput id="estLeaveLast" className="w-full" />
            </td>
            <td className="border border-slate-400 px-2 py-1">
              <UnderlineInput id="estLeaveCurrent" className="w-full" />
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
              <UnderlineInput id="estPeriodNatureLast" className="w-full" />
            </td>
            <td className="border border-slate-400 px-2 py-1">
              <UnderlineInput id="estPeriodNatureCurrent" className="w-full" />
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

const AccountsSection = () => (
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
            <th className="border border-slate-400 px-2 py-1 text-left">To</th>
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
                <UnderlineInput id={`accountsFrom${row}`} className="w-full" />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput id={`accountsTo${row}`} className="w-full" />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput id={`accountsMode${row}`} className="w-full" />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput id={`accountsFares${row}`} className="w-full" />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id={`accountsSingleFare${row}`}
                  className="w-full"
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id={`accountsAmount${row}`}
                  className="w-full"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="space-y-2 text-[11px]">
      <p>
        Total Rs. <UnderlineInput id="accountsTotal" width="w-40" />
      </p>
      <p>
        Advance admissible (90% of above) = Rs.{" "}
        <UnderlineInput id="accountsAdmissible" width="w-32" /> Passed for Rs.{" "}
        <UnderlineInput id="accountsPassed" width="w-32" />
      </p>
      <p>
        (in words); Rupees <UnderlineInput id="accountsInWords" width="w-64" />
      </p>
      <p>
        Debitable to LTC advance Dr./Mr./Mrs./Ms{" "}
        <UnderlineInput id="accountsDebitable" width="w-64" />
      </p>
    </div>
    <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
      <span>JAA/SAA</span>
      <span>JAO/AO</span>
      <span>AR/DR</span>
    </div>
  </div>
);

const AuditSection = () => (
  <div className="space-y-3 text-[12px] text-slate-900">
    <div className="text-center font-semibold">
      (C) For use by the Audit Section
    </div>
    <div className="border border-slate-400 p-3 text-[11px]">
      <p>Comments/Observations:</p>
      <UnderlineInput id="auditComments" className="mt-2 w-full" />
    </div>
    <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
      <span>Dealing Assistant</span>
      <span>JAO/AO</span>
      <span>Sr. Audit Officer</span>
    </div>
    <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
      <div className="flex items-center gap-2">
        <span>Recommended & Forwarded</span>
        <UnderlineInput id="auditRecommended" width="w-40" />
        <span>Registrar</span>
      </div>
      <div className="flex items-center gap-2">
        <span>Approved/Not Approved</span>
        <UnderlineInput id="auditApproved" width="w-40" />
        <span>Dean (F&A)</span>
      </div>
    </div>
  </div>
);
