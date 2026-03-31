"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  SignatureOtpVerificationCard,
  type SignatureCapture,
} from "@/components/leaves/signature-otp-verification-card";
import {
  DIGITAL_SIGNATURE_VALUE,
  useSignatureOtp,
} from "@/components/leaves/use-signature-otp";

export type LtcApprovalActor = "HOD" | "ESTABLISHMENT" | "ACCOUNTS";

export type LtcEstablishmentFields = {
  freshRecruitDate: string;
  estBlockYear: string;
  estNatureParticular: string;
  estNatureLast: string;
  estNatureCurrent: string;
  estPeriodFrom: string;
  estPeriodTo: string;
  estPeriodLast: string;
  estPeriodCurrent: string;
  estSelfFamilyParticular: string;
  estSelfFamilyLast: string;
  estSelfFamilyCurrent: string;
  estEncashParticular: string;
  estEncashLast: string;
  estEncashCurrent: string;
  estEarnedLeaveCreditOn: string;
  estEarnedLeaveStanding: string;
  estEarnedLeaveBalanceAfterEncashment: string;
  estEarnedLeaveEncashmentAdmissible: string;
  estLeaveLast: string;
  estLeaveCurrent: string;
  estPeriodNatureParticular: string;
  estPeriodNatureLast: string;
  estPeriodNatureCurrent: string;
};

export type LtcAccountsFields = {
  accountsFrom1: string;
  accountsTo1: string;
  accountsMode1: string;
  accountsFares1: string;
  accountsSingleFare1: string;
  accountsAmount1: string;
  accountsFrom2: string;
  accountsTo2: string;
  accountsMode2: string;
  accountsFares2: string;
  accountsSingleFare2: string;
  accountsAmount2: string;
  accountsFrom3: string;
  accountsTo3: string;
  accountsMode3: string;
  accountsFares3: string;
  accountsSingleFare3: string;
  accountsAmount3: string;
  accountsFrom4: string;
  accountsTo4: string;
  accountsMode4: string;
  accountsFares4: string;
  accountsSingleFare4: string;
  accountsAmount4: string;
  accountsTotal: string;
  accountsAdmissible: string;
  accountsPassed: string;
  accountsInWords: string;
  accountsDebitable: string;
};

const ESTABLISHMENT_KEYS: Array<keyof LtcEstablishmentFields> = [
  "freshRecruitDate",
  "estBlockYear",
  "estNatureParticular",
  "estNatureLast",
  "estNatureCurrent",
  "estPeriodFrom",
  "estPeriodTo",
  "estPeriodLast",
  "estPeriodCurrent",
  "estSelfFamilyParticular",
  "estSelfFamilyLast",
  "estSelfFamilyCurrent",
  "estEncashParticular",
  "estEncashLast",
  "estEncashCurrent",
  "estEarnedLeaveCreditOn",
  "estEarnedLeaveStanding",
  "estEarnedLeaveBalanceAfterEncashment",
  "estEarnedLeaveEncashmentAdmissible",
  "estLeaveLast",
  "estLeaveCurrent",
  "estPeriodNatureParticular",
  "estPeriodNatureLast",
  "estPeriodNatureCurrent",
];

const ACCOUNTS_KEYS: Array<keyof LtcAccountsFields> = [
  "accountsFrom1",
  "accountsTo1",
  "accountsMode1",
  "accountsFares1",
  "accountsSingleFare1",
  "accountsAmount1",
  "accountsFrom2",
  "accountsTo2",
  "accountsMode2",
  "accountsFares2",
  "accountsSingleFare2",
  "accountsAmount2",
  "accountsFrom3",
  "accountsTo3",
  "accountsMode3",
  "accountsFares3",
  "accountsSingleFare3",
  "accountsAmount3",
  "accountsFrom4",
  "accountsTo4",
  "accountsMode4",
  "accountsFares4",
  "accountsSingleFare4",
  "accountsAmount4",
  "accountsTotal",
  "accountsAdmissible",
  "accountsPassed",
  "accountsInWords",
  "accountsDebitable",
];

const pickString = (
  obj: Record<string, string> | null | undefined,
  key: string,
) => (typeof obj?.[key] === "string" ? obj[key] : "");

export type LtcApprovalModalData = {
  actor: LtcApprovalActor;
  applicationId: string;
  referenceCode: string;
  applicantName: string;
  applicantDepartment: string;
  currentApprovalActor?: string | null;
  formData: Record<string, string> | null;
  defaultRemarks?: string;
  onApprove: (payload: {
    remarks?: string;
    hodSignature?: string;
    approverSignatureProof?: SignatureCapture;
    formDataPatch?: Record<string, string>;
  }) => Promise<void>;
  onClose: () => void;
};

export type LtcHodApprovalModalData = {
  applicationId: string;
  referenceCode: string;
  applicantName: string;
  applicantDepartment: string;
  defaultRemarks?: string;
  onApprove: (payload: {
    remarks?: string;
    hodSignature?: string;
    approverSignatureProof?: SignatureCapture;
  }) => Promise<void>;
  onClose: () => void;
};

export const LtcHodApprovalActions = ({
  applicationId,
  defaultRemarks,
  onApprove,
  disabled,
}: {
  applicationId: string;
  defaultRemarks?: string;
  onApprove: (payload: {
    remarks?: string;
    hodSignature?: string;
    approverSignatureProof?: SignatureCapture;
  }) => Promise<void>;
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
    setRemarks(defaultRemarks ?? "NA");
    setError(null);
    signature.resetAfterSubmit({ clearSignature: true });
    const storedEmail =
      typeof window !== "undefined"
        ? window.localStorage.getItem("lf-user-email")
        : null;
    signature.setOtpEmail(storedEmail ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const canSubmit = signature.ensureReadyForSubmit() === null;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4">
      <SignatureOtpVerificationCard
        storageScope={`ltc-approval:${applicationId}`}
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
        isSubmitting={isSubmitting || disabled}
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
          disabled={isSubmitting || disabled}
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button
          onClick={async () => {
            setError(null);
            const readyError = signature.ensureReadyForSubmit({
              typed: "Please type your signature before approving.",
              digital:
                "Please complete signature capture + OTP verification before approving.",
            });
            if (readyError) {
              setError(readyError);
              return;
            }

            setIsSubmitting(true);
            try {
              await onApprove({
                remarks: remarks.trim() || undefined,
                hodSignature: DIGITAL_SIGNATURE_VALUE,
                approverSignatureProof: signature.signatureCapture ?? undefined,
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
          disabled={!canSubmit || isSubmitting || disabled}
        >
          {isSubmitting ? "Approving..." : "Confirm approve"}
        </Button>
      </div>
    </div>
  );
};

export const LtcHodApprovalModal = ({
  isOpen,
  data,
  disabled,
}: {
  isOpen: boolean;
  data: LtcHodApprovalModalData | null;
  disabled?: boolean;
}) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <SurfaceCard className="w-full max-w-3xl space-y-5 border-slate-200/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xl font-semibold text-slate-900">
              Approve LTC — HoD signature verification
            </p>
            <p className="text-sm text-slate-600">
              {data.referenceCode} • {data.applicantName} •{" "}
              {data.applicantDepartment}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={data.onClose}
            disabled={Boolean(disabled)}
          >
            Close
          </Button>
        </div>

        <LtcHodApprovalActions
          applicationId={data.applicationId}
          defaultRemarks={data.defaultRemarks}
          disabled={Boolean(disabled)}
          onApprove={data.onApprove}
        />
      </SurfaceCard>
    </div>
  );
};

export const LtcEstablishmentApprovalActions = ({
  applicationId,
  formData,
  defaultRemarks,
  onApprove,
  disabled,
}: {
  applicationId: string;
  formData: Record<string, string> | null;
  defaultRemarks?: string;
  onApprove: (payload: {
    remarks?: string;
    formDataPatch: Record<string, string>;
  }) => Promise<void>;
  disabled: boolean;
}) => {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estForm, setEstForm] = useState<LtcEstablishmentFields>(() => ({
    freshRecruitDate: "",
    estBlockYear: "",
    estNatureParticular: "",
    estNatureLast: "",
    estNatureCurrent: "",
    estPeriodFrom: "",
    estPeriodTo: "",
    estPeriodLast: "",
    estPeriodCurrent: "",
    estSelfFamilyParticular: "",
    estSelfFamilyLast: "",
    estSelfFamilyCurrent: "",
    estEncashParticular: "",
    estEncashLast: "",
    estEncashCurrent: "",
    estEarnedLeaveCreditOn: "",
    estEarnedLeaveStanding: "",
    estEarnedLeaveBalanceAfterEncashment: "",
    estEarnedLeaveEncashmentAdmissible: "",
    estLeaveLast: "",
    estLeaveCurrent: "",
    estPeriodNatureParticular: "",
    estPeriodNatureLast: "",
    estPeriodNatureCurrent: "",
  }));

  useEffect(() => {
    setRemarks(defaultRemarks ?? "NA");
    setError(null);
    setEstForm((current) => {
      const next: LtcEstablishmentFields = { ...current };
      for (const key of ESTABLISHMENT_KEYS) {
        next[key] = pickString(formData, key);
      }
      return next;
    });
  }, [applicationId, defaultRemarks, formData]);

  const canSubmit = useMemo(() => {
    const hasAny = ESTABLISHMENT_KEYS.some(
      (key) => estForm[key].trim().length > 0,
    );
    return hasAny;
  }, [estForm]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Establishment section
        </p>
        <p className="text-sm text-slate-600">
          Fill the establishment details below and submit.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Date of joining (if applicable)
          </label>
          <input
            type="date"
            value={estForm.freshRecruitDate}
            onChange={(event) =>
              setEstForm((prev) => ({
                ...prev,
                freshRecruitDate: event.target.value,
              }))
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            disabled={isSubmitting || disabled}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Block year
          </label>
          <input
            type="text"
            value={estForm.estBlockYear}
            onChange={(event) =>
              setEstForm((prev) => ({
                ...prev,
                estBlockYear: event.target.value,
              }))
            }
            placeholder="e.g. 2022-2025"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            disabled={isSubmitting || disabled}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-180 border border-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Particulars
              </th>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Last availed
              </th>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Current LTC
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 px-3 py-2">
                <div className="space-y-2">
                  <div>Nature of LTC</div>
                  <input
                    value={estForm.estNatureParticular}
                    onChange={(event) =>
                      setEstForm((prev) => ({
                        ...prev,
                        estNatureParticular: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </div>
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estNatureLast}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estNatureLast: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estNatureCurrent}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estNatureCurrent: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
            </tr>

            <tr>
              <td className="border border-slate-200 px-3 py-2">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Period (from</span>
                    <input
                      value={estForm.estPeriodFrom}
                      onChange={(event) =>
                        setEstForm((prev) => ({
                          ...prev,
                          estPeriodFrom: event.target.value,
                        }))
                      }
                      className="h-9 w-32 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                      disabled={isSubmitting || disabled}
                    />
                    <span>to</span>
                    <input
                      value={estForm.estPeriodTo}
                      onChange={(event) =>
                        setEstForm((prev) => ({
                          ...prev,
                          estPeriodTo: event.target.value,
                        }))
                      }
                      className="h-9 w-32 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                      disabled={isSubmitting || disabled}
                    />
                    <span>)</span>
                  </div>
                </div>
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estPeriodLast}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estPeriodLast: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estPeriodCurrent}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estPeriodCurrent: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
            </tr>

            <tr>
              <td className="border border-slate-200 px-3 py-2">
                <div className="space-y-2">
                  <div>LTC for Self/Family</div>
                  <input
                    value={estForm.estSelfFamilyParticular}
                    onChange={(event) =>
                      setEstForm((prev) => ({
                        ...prev,
                        estSelfFamilyParticular: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </div>
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estSelfFamilyLast}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estSelfFamilyLast: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estSelfFamilyCurrent}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estSelfFamilyCurrent: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
            </tr>

            <tr>
              <td className="border border-slate-200 px-3 py-2">
                <div className="space-y-2">
                  <div>Earned leave encashment (No. of Days)</div>
                  <input
                    value={estForm.estEncashParticular}
                    onChange={(event) =>
                      setEstForm((prev) => ({
                        ...prev,
                        estEncashParticular: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </div>
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estEncashLast}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estEncashLast: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estEncashCurrent}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estEncashCurrent: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
            </tr>

            <tr>
              <td className="border border-slate-200 px-3 py-2">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Earned Leave standing to his credit on</span>
                    <input
                      value={estForm.estEarnedLeaveCreditOn}
                      onChange={(event) =>
                        setEstForm((prev) => ({
                          ...prev,
                          estEarnedLeaveCreditOn: event.target.value,
                        }))
                      }
                      className="h-9 w-40 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                      disabled={isSubmitting || disabled}
                    />
                    <span>=</span>
                    <input
                      value={estForm.estEarnedLeaveStanding}
                      onChange={(event) =>
                        setEstForm((prev) => ({
                          ...prev,
                          estEarnedLeaveStanding: event.target.value,
                        }))
                      }
                      className="h-9 w-40 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                      disabled={isSubmitting || disabled}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Balance Earned leave after this encashment</span>
                    <span>=</span>
                    <input
                      value={estForm.estEarnedLeaveBalanceAfterEncashment}
                      onChange={(event) =>
                        setEstForm((prev) => ({
                          ...prev,
                          estEarnedLeaveBalanceAfterEncashment:
                            event.target.value,
                        }))
                      }
                      className="h-9 w-48 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                      disabled={isSubmitting || disabled}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Earned Leave encashment admissible</span>
                    <span>=</span>
                    <input
                      value={estForm.estEarnedLeaveEncashmentAdmissible}
                      onChange={(event) =>
                        setEstForm((prev) => ({
                          ...prev,
                          estEarnedLeaveEncashmentAdmissible:
                            event.target.value,
                        }))
                      }
                      className="h-9 w-48 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                      disabled={isSubmitting || disabled}
                    />
                  </div>
                </div>
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estLeaveLast}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estLeaveLast: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estLeaveCurrent}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estLeaveCurrent: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
            </tr>

            <tr>
              <td className="border border-slate-200 px-3 py-2">
                <div className="space-y-2">
                  <div>Period and nature of leave applied</div>
                  <input
                    value={estForm.estPeriodNatureParticular}
                    onChange={(event) =>
                      setEstForm((prev) => ({
                        ...prev,
                        estPeriodNatureParticular: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </div>
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estPeriodNatureLast}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estPeriodNatureLast: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
              <td className="border border-slate-200 px-3 py-2">
                <input
                  value={estForm.estPeriodNatureCurrent}
                  onChange={(event) =>
                    setEstForm((prev) => ({
                      ...prev,
                      estPeriodNatureCurrent: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  disabled={isSubmitting || disabled}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Remarks (optional)
        </label>
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
          disabled={isSubmitting || disabled}
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {!canSubmit ? (
        <p className="text-xs text-slate-500">
          Enter at least one establishment value before submitting.
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          onClick={async () => {
            setError(null);
            if (!canSubmit) {
              setError(
                "Please fill the Establishment section details before submitting.",
              );
              return;
            }

            const patch: Record<string, string> = {};
            for (const key of ESTABLISHMENT_KEYS) {
              patch[key] = estForm[key].trim();
            }

            setIsSubmitting(true);
            try {
              await onApprove({
                remarks: remarks.trim() || undefined,
                formDataPatch: patch,
              });
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
          disabled={!canSubmit || isSubmitting || disabled}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
};

export const LtcAccountsApprovalActions = ({
  applicationId,
  formData,
  defaultRemarks,
  onApprove,
  disabled,
}: {
  applicationId: string;
  formData: Record<string, string> | null;
  defaultRemarks?: string;
  onApprove: (payload: {
    remarks?: string;
    formDataPatch: Record<string, string>;
  }) => Promise<void>;
  disabled: boolean;
}) => {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountsForm, setAccountsForm] = useState<LtcAccountsFields>(() => ({
    accountsFrom1: "",
    accountsTo1: "",
    accountsMode1: "",
    accountsFares1: "",
    accountsSingleFare1: "",
    accountsAmount1: "",
    accountsFrom2: "",
    accountsTo2: "",
    accountsMode2: "",
    accountsFares2: "",
    accountsSingleFare2: "",
    accountsAmount2: "",
    accountsFrom3: "",
    accountsTo3: "",
    accountsMode3: "",
    accountsFares3: "",
    accountsSingleFare3: "",
    accountsAmount3: "",
    accountsFrom4: "",
    accountsTo4: "",
    accountsMode4: "",
    accountsFares4: "",
    accountsSingleFare4: "",
    accountsAmount4: "",
    accountsTotal: "",
    accountsAdmissible: "",
    accountsPassed: "",
    accountsInWords: "",
    accountsDebitable: "",
  }));

  useEffect(() => {
    setRemarks(defaultRemarks ?? "NA");
    setError(null);
    setAccountsForm((current) => {
      const next: LtcAccountsFields = { ...current };
      for (const key of ACCOUNTS_KEYS) {
        next[key] = pickString(formData, key);
      }
      return next;
    });
  }, [applicationId, defaultRemarks, formData]);

  const canSubmit = useMemo(() => {
    return ACCOUNTS_KEYS.some((key) => accountsForm[key].trim().length > 0);
  }, [accountsForm]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Accounts section
        </p>
        <p className="text-sm text-slate-600">
          Enter the accounts details below and submit.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-180 border border-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                From
              </th>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                To
              </th>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Mode of Travel
              </th>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                No. of fares
              </th>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Single fare
              </th>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((row) => (
              <tr key={row}>
                <td className="border border-slate-200 px-3 py-2">
                  <input
                    value={
                      accountsForm[
                        `accountsFrom${row}` as keyof LtcAccountsFields
                      ]
                    }
                    onChange={(event) =>
                      setAccountsForm((prev) => ({
                        ...prev,
                        [`accountsFrom${row}`]: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  <input
                    value={
                      accountsForm[
                        `accountsTo${row}` as keyof LtcAccountsFields
                      ]
                    }
                    onChange={(event) =>
                      setAccountsForm((prev) => ({
                        ...prev,
                        [`accountsTo${row}`]: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  <input
                    value={
                      accountsForm[
                        `accountsMode${row}` as keyof LtcAccountsFields
                      ]
                    }
                    onChange={(event) =>
                      setAccountsForm((prev) => ({
                        ...prev,
                        [`accountsMode${row}`]: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  <input
                    value={
                      accountsForm[
                        `accountsFares${row}` as keyof LtcAccountsFields
                      ]
                    }
                    onChange={(event) =>
                      setAccountsForm((prev) => ({
                        ...prev,
                        [`accountsFares${row}`]: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  <input
                    value={
                      accountsForm[
                        `accountsSingleFare${row}` as keyof LtcAccountsFields
                      ]
                    }
                    onChange={(event) =>
                      setAccountsForm((prev) => ({
                        ...prev,
                        [`accountsSingleFare${row}`]: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  <input
                    value={
                      accountsForm[
                        `accountsAmount${row}` as keyof LtcAccountsFields
                      ]
                    }
                    onChange={(event) =>
                      setAccountsForm((prev) => ({
                        ...prev,
                        [`accountsAmount${row}`]: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    disabled={isSubmitting || disabled}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Total Rs.
          </label>
          <input
            value={accountsForm.accountsTotal}
            onChange={(event) =>
              setAccountsForm((prev) => ({
                ...prev,
                accountsTotal: event.target.value,
              }))
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            disabled={isSubmitting || disabled}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Advance admissible (90% of above)
          </label>
          <input
            value={accountsForm.accountsAdmissible}
            onChange={(event) =>
              setAccountsForm((prev) => ({
                ...prev,
                accountsAdmissible: event.target.value,
              }))
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            disabled={isSubmitting || disabled}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Passed for Rs.
          </label>
          <input
            value={accountsForm.accountsPassed}
            onChange={(event) =>
              setAccountsForm((prev) => ({
                ...prev,
                accountsPassed: event.target.value,
              }))
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            disabled={isSubmitting || disabled}
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-semibold text-slate-700">
            (in words) Rupees
          </label>
          <input
            value={accountsForm.accountsInWords}
            onChange={(event) =>
              setAccountsForm((prev) => ({
                ...prev,
                accountsInWords: event.target.value,
              }))
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            disabled={isSubmitting || disabled}
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-semibold text-slate-700">
            Debitable to LTC advance
          </label>
          <input
            value={accountsForm.accountsDebitable}
            onChange={(event) =>
              setAccountsForm((prev) => ({
                ...prev,
                accountsDebitable: event.target.value,
              }))
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            disabled={isSubmitting || disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Remarks (optional)
        </label>
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
          disabled={isSubmitting || disabled}
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {!canSubmit ? (
        <p className="text-xs text-slate-500">
          Enter at least one accounts value before submitting.
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          onClick={async () => {
            setError(null);
            if (!canSubmit) {
              setError(
                "Please fill the Accounts section details before submitting.",
              );
              return;
            }

            const patch: Record<string, string> = {};
            for (const key of ACCOUNTS_KEYS) {
              patch[key] = accountsForm[key].trim();
            }

            setIsSubmitting(true);
            try {
              await onApprove({
                remarks: remarks.trim() || undefined,
                formDataPatch: patch,
              });
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Unable to submit right now.",
              );
            } finally {
              setIsSubmitting(false);
            }
          }}
          disabled={!canSubmit || isSubmitting || disabled}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
};
