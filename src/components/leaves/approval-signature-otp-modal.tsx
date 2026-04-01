"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  SignatureOtpVerificationCard,
  type SignatureCapture,
} from "@/components/leaves/signature-otp-verification-card";
import { useSignatureOtp } from "@/components/leaves/use-signature-otp";

export type ApprovalSignatureOtpModalData = {
  applicationId: string;
  referenceCode: string;
  applicantName: string;
  applicantDepartment: string;
  leaveType: string;
  title?: string;
  defaultRemarks?: string;
  onApprove: (payload: {
    remarks?: string;
    approverSignatureProof: SignatureCapture;
  }) => Promise<void>;
  onClose: () => void;
};

export const ApprovalSignatureOtpModal = ({
  isOpen,
  data,
  disabled,
}: {
  isOpen: boolean;
  data: ApprovalSignatureOtpModalData | null;
  disabled: boolean;
}) => {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signature = useSignatureOtp({
    enableTyped: true,
    requireOtpForTyped: true,
  });

  useEffect(() => {
    if (!data) return;

    setRemarks(data.defaultRemarks ?? "NA");
    setError(null);
    setIsSubmitting(false);

    signature.resetAfterSubmit({ clearSignature: true });

    const storedEmail =
      typeof window !== "undefined"
        ? window.localStorage.getItem("lf-user-email")
        : null;
    signature.setOtpEmail(storedEmail ?? "");

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.applicationId]);

  if (!isOpen || !data) return null;

  const canSubmit = signature.ensureReadyForSubmit() === null;
  const modalTitle = data.title ?? "Approve request — signature verification";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-8">
      <SurfaceCard className="w-full max-w-3xl border-slate-200/80 p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xl font-semibold text-slate-900">
                {modalTitle}
              </p>
              <p className="text-sm text-slate-600">
                {data.referenceCode} • {data.applicantName} •{" "}
                {data.applicantDepartment} • {data.leaveType}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={data.onClose}
              disabled={disabled || isSubmitting}
            >
              Close
            </Button>
          </div>

          <div className="space-y-5">
            <SignatureOtpVerificationCard
              storageScope={`approval-signature:${data.applicationId}`}
              signatureMode={signature.signatureMode}
              onSignatureModeChange={signature.onSignatureModeChange}
              typedSignature={signature.typedSignature}
              onTypedSignatureChange={signature.onTypedSignatureChange}
              requireOtpForTyped
              otpEmail={signature.otpEmail}
              otpCode={signature.otpCode}
              onOtpCodeChange={signature.setOtpCode}
              otpStatusMessage={signature.otpStatusMessage}
              isSendingOtp={signature.isSendingOtp}
              isVerifyingOtp={signature.isVerifyingOtp}
              isSubmitting={disabled || isSubmitting}
              onSendOtp={signature.handleSendOtp}
              onVerifyOtp={signature.handleVerifyOtp}
              onSignatureChange={signature.onSignatureChange}
              isOtpVerified={signature.isOtpVerified}
            />

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Remarks (optional)
              </label>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                disabled={disabled || isSubmitting}
              />
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={async () => {
                setError(null);
                const readyError = signature.ensureReadyForSubmit({
                  typed:
                    "Please type your signature, then complete OTP verification before approving.",
                  digital:
                    "Please complete signature capture + OTP verification before approving.",
                });
                if (readyError) {
                  setError(readyError);
                  return;
                }

                if (!signature.signatureCapture) {
                  setError("Please provide your signature before approving.");
                  return;
                }

                setIsSubmitting(true);
                try {
                  await data.onApprove({
                    remarks: remarks.trim() || undefined,
                    approverSignatureProof: signature.signatureCapture,
                  });
                  signature.resetAfterSubmit({ clearSignature: true });
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Unable to approve right now.",
                  );
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={!canSubmit || disabled || isSubmitting}
            >
              {isSubmitting ? "Approving..." : "Approve"}
            </Button>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
};
