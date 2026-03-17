"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SignatureOtpVerificationCard } from "@/components/leaves/signature-otp-verification-card";
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
    onSignatureModeChange,
    onTypedSignatureChange,
    onSignatureChange,
    ensureReadyForSubmit,
    handleSendOtp,
    handleVerifyOtp,
    resetAfterSubmit,
  } = useSignatureOtp({ enableTyped: false });

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
    Object.keys(data).forEach((key) => {
      if (isSignatureFieldId(key)) {
        data[key] = DIGITAL_SIGNATURE_VALUE;
      }
    });
    saveFormDraft("ex-india-leave", data);
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

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    void applyAutofillToForm(form, "ex-india-leave").then((profile) => {
      setOtpEmail(profile.email ?? "");
    });
  }, [setOtpEmail]);

  const handleConfirmSubmit = () => {
    const signatureError = ensureReadyForSubmit({
      digital:
        "Complete digital signature and OTP verification before submitting.",
    });
    if (signatureError) {
      window.alert(signatureError);
      return;
    }
    setConfirmed(true);
    setDialogState("success");
    resetAfterSubmit();
    console.log("Ex-India leave form submitted", pendingDataRef.current);
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

  const pageLabel = useMemo(() => `${pages[page]} (${page + 1}/4)`, [page]);

  return (
    <DashboardShell>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
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

        {page === 0 && <FormPage />}
        {page === 1 && <LetterPage />}
        {page === 2 && <UndertakingFormOne />}
        {page === 3 && <UndertakingFormTwo />}

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
          isSubmitting={false}
          onSendOtp={handleSendOtp}
          onVerifyOtp={handleVerifyOtp}
          onSignatureChange={onSignatureChange}
          isOtpVerified={isOtpVerified}
        />

        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          {confirmed
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

const FormPage = () => (
  <SurfaceCard className="mx-auto max-w-4xl space-y-4 border border-slate-300 bg-white p-4 md:p-6">
    <header className="space-y-1 text-center text-slate-900">
      <p className="text-base font-semibold">
        भारतीय प्रौद्योगिकी संस्थान रोपड़
      </p>
      <p className="text-base font-semibold uppercase">
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
      <table className="w-full border border-slate-400 text-[12px] text-slate-900">
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
          <Row
            label="4. अवकाश का प्रकार / Nature of Leave applied for"
            inputId="leaveType"
          />
          <RowPeriod />
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
      <UnderlineInput id="applicantSignature" width="w-60" />
    </p>

    <div className="space-y-2 border-t border-slate-400 pt-2 text-[12px] text-slate-900">
      <p className="font-semibold text-center">
        नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें / Remarks and
        Recommendations of the controlling officer
      </p>
      <p>
        सिफारिश की गई / Recommended या नहीं की गई / not recommended:{" "}
        <UnderlineInput id="recommended" width="w-44" />
      </p>
      <p>
        विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित / Signature with
        date Head of Department/Section In-charge:
        <UnderlineInput id="hodSignature" width="w-60" className="ml-2" />
      </p>
    </div>

    <div className="space-y-2 border-t border-slate-400 pt-2 text-[12px] text-slate-900">
      <p className="text-center font-semibold">
        प्रशासनिक अनुभाग द्वारा प्रयोग हेतु / For use by the Administration
        Section
      </p>
      <p>
        प्रमाणित किया जाता है कि (प्रकृति) / Certified that (nature of leave)
        for period, from
        <UnderlineInput id="adminFrom" width="w-32" /> to{" "}
        <UnderlineInput id="adminTo" width="w-32" /> is available as per
        following details:
      </p>
      <p>
        अवकाश का प्रकार / Nature of leave applied for{" "}
        <UnderlineInput id="adminLeaveType" width="w-44" /> आज की तिथि तक शेष /
        Balance as on date
        <UnderlineInput id="balance" width="w-28" /> कुल दिनों के लिए अवकाश /
        Leave applied for (No. of days)
        <UnderlineInput id="adminDays" width="w-24" />
      </p>
      <p>
        संबंधित सहायक / Dealing Assistant{" "}
        <UnderlineInput id="assistant" width="w-44" className="ml-2" /> Jr.
        Supdt.
        <UnderlineInput id="jrSupdt" width="w-36" className="ml-2" /> अधि./सहा.
        कुलसचिव/अनुभागाध्यक्ष/ सुपdt./AR/DR
        <UnderlineInput id="arDr" width="w-44" className="ml-2" />
      </p>
      <p className="flex flex-wrap items-center gap-2">
        कुलसचिव/ अधिकारी (Faculty Affairs & Administration) के हस्ताक्षर /
        Signature of Registrar / Dean (Faculty Affairs & Administration)
        <UnderlineInput id="registrarSign" width="w-52" />
        <span>
          छुट्टी प्रदान करने के लिए सक्षम प्राधिकारी की टिप्पणी : स्वीकृत /
          अस्वीकृत / Comments of the competent authority to grant leave:
          Sanctioned / Not Sanctioned
        </span>
      </p>
      <p>
        निदेशक / Director: <UnderlineInput id="directorSign" width="w-52" />
      </p>
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

const RowPeriod = () => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      5. छुट्टी की अवधि / Period of Leave
    </td>
    <td className="px-3 py-2 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span>से / From:</span>
        <UnderlineInput id="fromDate" width="w-32" />
        <span>तक / To:</span>
        <UnderlineInput id="toDate" width="w-32" />
        <span>दिनों की संख्या / No. of days:</span>
        <UnderlineInput id="days" width="w-20" />
      </div>
    </td>
  </tr>
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

const LetterPage = () => (
  <SurfaceCard className="mx-auto max-w-4xl space-y-4 border border-slate-300 bg-white p-6">
    <div className="text-[13px] text-slate-900">
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
        I request that I may kindly be granted leave of the due / leave without
        pay Ex-India for
        <UnderlineInput id="exDays" width="w-20" /> days from{" "}
        <UnderlineInput id="exFrom" width="w-32" /> to{" "}
        <UnderlineInput id="exTo" width="w-32" />. I am holding a valid passport
        for visit to the aforesaid country / countries.
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

      <div className="mt-6 text-right space-y-4">
        <p>Yours faithfully,</p>
        <div className="space-y-2">
          <p>
            Signature{" "}
            <UnderlineInput
              id="letterSignature"
              width="w-56"
              className="ml-2"
            />
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

      <div className="mt-6 space-y-2 text-[13px] text-slate-900">
        <p>
          Dated: <UnderlineInput id="letterDated" width="w-40" />
        </p>
        <p>Recommendations of the Head of the Department</p>
      </div>
    </div>
  </SurfaceCard>
);

const UndertakingFormOne = () => (
  <SurfaceCard className="mx-auto max-w-4xl space-y-6 border border-slate-300 bg-white p-6">
    <div className="flex justify-end text-[13px] font-semibold text-slate-900">
      Form - I
    </div>
    <div className="space-y-2 text-center text-[13px] text-slate-900">
      <p className="font-semibold underline">UNDERTAKING</p>
    </div>
    <div className="space-y-4 text-[13px] text-slate-900">
      <p>
        I, <UnderlineInput id="u1Name" width="w-60" />,{" "}
        <UnderlineInput id="u1Designation" width="w-60" /> (Designation) is
        proceeding on Ex-India Leave (EL) to
        <UnderlineInput id="u1Country" width="w-60" /> (Country) for{" "}
        <UnderlineInput id="u1Days" width="w-20" /> days from
        <UnderlineInput id="u1From" width="w-32" /> to{" "}
        <UnderlineInput id="u1To" width="w-32" />.
      </p>
      <p>
        I hereby certify that no Institute dues are outstanding against me.
        Further I undertake that if I did not return back on the due date i.e.{" "}
        <UnderlineInput id="u1DueDate" width="w-32" />, any dues of the
        Institute found later on, the same may be recovered from my payable
        balances available with the Institute.
      </p>
      <p>
        Date: <UnderlineInput id="u1Date" width="w-32" />
      </p>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2 text-[13px] text-slate-900">
          <p className="font-semibold">Witness</p>
          <p>
            Signature{" "}
            <UnderlineInput id="u1WitnessSign" width="w-48" className="ml-2" />
          </p>
          <p>
            Name{" "}
            <UnderlineInput id="u1WitnessName" width="w-48" className="ml-2" />
          </p>
          <p>
            E. Code No.{" "}
            <UnderlineInput id="u1WitnessCode" width="w-40" className="ml-2" />
          </p>
          <p>
            Department{" "}
            <UnderlineInput id="u1WitnessDept" width="w-48" className="ml-2" />
          </p>
        </div>
        <div className="space-y-2 text-right text-[13px] text-slate-900">
          <p>
            Signature{" "}
            <UnderlineInput id="u1Sign" width="w-48" className="ml-2" />
          </p>
          <p>
            Name:{" "}
            <UnderlineInput id="u1SignName" width="w-48" className="ml-2" />
          </p>
          <p>
            Employee Code:{" "}
            <UnderlineInput id="u1SignCode" width="w-40" className="ml-2" />
          </p>
          <p>
            Department:{" "}
            <UnderlineInput id="u1SignDept" width="w-48" className="ml-2" />
          </p>
        </div>
      </div>
    </div>
  </SurfaceCard>
);

const UndertakingFormTwo = () => (
  <SurfaceCard className="mx-auto max-w-4xl space-y-6 border border-slate-300 bg-white p-6">
    <div className="flex justify-end text-[13px] font-semibold text-slate-900">
      Form - II
    </div>
    <div className="space-y-2 text-center text-[13px] text-slate-900">
      <p className="font-semibold underline">
        UNDERTAKING/ AGREEMENT FROM A MEMBER OF STAFF OF IIT ROPAR PROCEEDING ON
        LEAVE EX-INDIA
      </p>
    </div>
    <div className="space-y-4 text-[13px] text-slate-900">
      <p>
        Whereas, I, <UnderlineInput id="u2Name" width="w-60" /> employed as
        Designation <UnderlineInput id="u2Designation" width="w-60" /> in the{" "}
        <UnderlineInput id="u2Dept" width="w-60" /> on Indian Institute of
        Technology, Ropar have applied for leave Ex-India for the period from{" "}
        <UnderlineInput id="u2From" width="w-32" /> to{" "}
        <UnderlineInput id="u2To" width="w-32" /> for private work.
      </p>
      <p>
        And whereas Indian Institute of Technology, Ropar have agreed to grant
        me leave Ex-India Leave of the kind due for period from{" "}
        <UnderlineInput id="u2LeaveFrom" width="w-32" /> to{" "}
        <UnderlineInput id="u2LeaveTo" width="w-32" /> on the condition that no
        extension of the said leave shall be allowed but the Institute may in
        special circumstances, on my request, extend the leave for such period
        as it may deem fit and if I fail to return to duty at the Institute on
        the expire of the aforesaid leave of such extended period of leave as
        the Institute may be pleased to extend. I shall be deemed to have
        resigned from my post at the Institute with effect from the day
        immediately next to the date of on which the said leave expires.
      </p>
      <p>
        Now, therefore, I hereby declare and agree that the grant of leave on
        the condition mentioned above is acceptable to me and I hereby undertake
        and agree to abide by the same and that in the event of my failure to
        return to the Institute on the expire of the above said leave or the
        extended period of leave. I shall be deemed to have resigned from the
        Institute post and my relation with the Institute as employee and
        employer shall cease immediately.
      </p>

      <div className="flex flex-wrap items-start justify-between gap-6 pt-4">
        <div className="space-y-2 text-[13px] text-slate-900">
          <p>
            Signature{" "}
            <UnderlineInput id="u2Sign" width="w-48" className="ml-2" />
          </p>
          <p>
            Name{" "}
            <UnderlineInput id="u2SignName" width="w-48" className="ml-2" />
          </p>
          <p>
            Department{" "}
            <UnderlineInput id="u2SignDept" width="w-48" className="ml-2" />
          </p>
          <p>
            Designation{" "}
            <UnderlineInput
              id="u2SignDesignation"
              width="w-48"
              className="ml-2"
            />
          </p>
        </div>

        <div className="space-y-2 text-[13px] text-slate-900">
          <p className="font-semibold">Signed in the presence of:</p>
          <div className="flex flex-wrap items-center gap-2">
            <span>Signature</span>
            <UnderlineInput id="u2Witness1Sign" width="w-44" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Name</span>
            <UnderlineInput id="u2Witness1Name" width="w-44" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Designation</span>
            <UnderlineInput id="u2Witness1Designation" width="w-44" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Date</span>
            <UnderlineInput id="u2Witness1Date" width="w-36" />
          </div>
        </div>

        <div className="space-y-2 text-[13px] text-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <span>Signature</span>
            <UnderlineInput id="u2Witness2Sign" width="w-44" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Name</span>
            <UnderlineInput id="u2Witness2Name" width="w-44" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Designation</span>
            <UnderlineInput id="u2Witness2Designation" width="w-44" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Date</span>
            <UnderlineInput id="u2Witness2Date" width="w-36" />
          </div>
        </div>
      </div>
    </div>
  </SurfaceCard>
);
