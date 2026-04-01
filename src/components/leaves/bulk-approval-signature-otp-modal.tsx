"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  SignatureOtpVerificationCard,
  type SignatureCapture,
} from "@/components/leaves/signature-otp-verification-card";
import { useSignatureOtp } from "@/components/leaves/use-signature-otp";

export type BulkApprovalPreviewItem = {
  applicationId: string;
  referenceCode: string;
  applicantName: string;
  applicantDepartment: string;
  leaveType: string;
};

export type BulkApprovalSignatureOtpModalData = {
  title?: string;
  items: BulkApprovalPreviewItem[];
  onApproveAll: (payload: {
    approverSignatureProof: SignatureCapture;
  }) => Promise<void>;
  onClose: () => void;
};

export const BulkApprovalSignatureOtpModal = ({
  isOpen,
  data,
  disabled,
}: {
  isOpen: boolean;
  data: BulkApprovalSignatureOtpModalData | null;
  disabled: boolean;
}) => {
  const [step, setStep] = useState<"review" | "sign">("review");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signature = useSignatureOtp({
    enableTyped: true,
    requireOtpForTyped: true,
  });

  const countLabel = useMemo(() => {
    const count = data?.items.length ?? 0;
    return `${count} application${count === 1 ? "" : "s"}`;
  }, [data?.items.length]);

  useEffect(() => {
    if (!data) return;

    setStep("review");
    setError(null);
    setIsSubmitting(false);

    signature.resetAfterSubmit({ clearSignature: true });

    const storedEmail =
      typeof window !== "undefined"
        ? window.localStorage.getItem("lf-user-email")
        : null;
    signature.setOtpEmail(storedEmail ?? "");

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.items.map((item) => item.applicationId).join("|")]);

  if (!isOpen || !data) return null;

  const canSubmit = signature.ensureReadyForSubmit() === null;
  const modalTitle = data.title ?? `Bulk approve — ${countLabel}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-8">
      <SurfaceCard className="max-h-[calc(100vh-4rem)] w-full max-w-3xl border-slate-200/80 p-6">
        <div className="flex h-full flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xl font-semibold text-slate-900">
                {modalTitle}
              </p>
              <p className="text-sm text-slate-600">
                Review the selected requests, confirm, then sign once to approve
                all.
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

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Selected applications
              </p>
              <div className="mt-3 space-y-2">
                {data.items.map((item) => (
                  <div
                    key={item.applicationId}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {item.referenceCode}
                    </p>
                    <p className="text-xs text-slate-600">
                      {item.applicantName} • {item.applicantDepartment} •{" "}
                      {item.leaveType}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {step === "sign" ? (
              <SignatureOtpVerificationCard
                storageScope={`bulk-approval-signature:${data.items[0]?.applicationId || "bulk"}`}
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
            ) : null}

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </div>

          <div className="flex justify-end gap-2">
            {step === "review" ? (
              <Button
                onClick={() => {
                  setError(null);
                  setStep("sign");
                }}
                disabled={disabled || isSubmitting || data.items.length === 0}
              >
                Confirm selection
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError(null);
                    setStep("review");
                    signature.resetAfterSubmit({ clearSignature: true });
                  }}
                  disabled={disabled || isSubmitting}
                >
                  Back
                </Button>
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
                      setError(
                        "Please provide your signature before approving.",
                      );
                      return;
                    }

                    setIsSubmitting(true);
                    try {
                      await data.onApproveAll({
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
                  {isSubmitting ? "Approving..." : "Approve all"}
                </Button>
              </>
            )}
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
};
