"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

export type EarnedLeaveApprovalData = {
  applicationId: string;
  referenceCode: string;
  leaveType?: string;
  applicantName: string;
  applicantRole: string;
  applicantDepartment: string;
  applicantDesignation: string;
  currentApprovalActor?: string | null;
  formData: Record<string, string> | null;
  purpose: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  isLoading?: boolean;
  decisionRequired?: boolean; // when false, renders read‑only view
  viewerOnly?: boolean; // synonym for decisionRequired === false
  onApprove?: (data: {
    decision: "APPROVE";
    recommended?: string;
    hodSignature?: string;
    accountsSignature?: string;
    balance?: string;
    decisionDate?: string;
    remarks?: string;
  }) => Promise<void>;
  onReject?: (data: { remarks: string; hodSignature?: string }) => Promise<void>;
  onClose: () => void;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const EarnedLeaveApprovalModal = ({
  isOpen,
  data,
}: {
  isOpen: boolean;
  data: EarnedLeaveApprovalData | null;
}) => {
  const [decision, setDecision] = useState<"PENDING" | "APPROVE" | "REJECT">(
    "PENDING"
  );
  const disableActions = data?.viewerOnly === true || data?.decisionRequired === false; // need only view
  const [recommended, setRecommended] = useState<"RECOMMENDED" | "NOT_RECOMMENDED" | "">(
    ""
  );
  const [hodSignature, setHodSignature] = useState("");
  const [decisionDate, setDecisionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [remarks, setRemarks] = useState("");
  const [balance, setBalance] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !data) return null;
  const isAccountsActor = data.currentApprovalActor === "ACCOUNTS";
  const isFinalAuthorityActor =
    data.currentApprovalActor === "DEAN" ||
    data.currentApprovalActor === "REGISTRAR" ||
    data.currentApprovalActor === "DIRECTOR";

  const handleApprove = async () => {
    if (!data.onApprove) {
      setError("Approval action is not available");
      return;
    }
    if (isAccountsActor) {
      if (!balance.trim()) {
        setError("Please fill balance as on date");
        return;
      }
    } else {
      if (!isFinalAuthorityActor && !recommended) {
        setError("Please select Recommended or Not Recommended");
        return;
      }
      if (!hodSignature.trim()) {
        setError("Please provide your signature");
        return;
      }
      if (!isFinalAuthorityActor && !decisionDate) {
        setError("Please select a decision date");
        return;
      }
      if (isFinalAuthorityActor && !remarks.trim()) {
        setError("Please provide comments");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await data.onApprove({
        decision: "APPROVE",
        recommended:
          isAccountsActor || isFinalAuthorityActor ? undefined : recommended,
        hodSignature: isAccountsActor ? undefined : hodSignature,
        accountsSignature: isAccountsActor ? "ACCOUNTS" : undefined,
        balance: isAccountsActor ? balance : undefined,
        decisionDate:
          isAccountsActor || isFinalAuthorityActor ? undefined : decisionDate,
        remarks: remarks || undefined,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit approval"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!data.onReject) {
      setError("Rejection action is not available");
      return;
    }
    if (!remarks.trim()) {
      setError("Please provide remarks for rejection");
      return;
    }
    if (isFinalAuthorityActor && !hodSignature.trim()) {
      setError("Please provide your signature");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await data.onReject({
        remarks,
        hodSignature: isFinalAuthorityActor ? hodSignature : undefined,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit rejection"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formEntries = Object.entries(data.formData ?? {}).filter(
    ([, value]) => value != null && `${value}`.trim() !== ""
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-8">
      <SurfaceCard className="w-full max-w-4xl space-y-6 border-slate-200 bg-white p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Earned Leave Approval
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">
              {data.referenceCode}
            </h2>
            <p className="text-sm text-slate-600">
              Processing approval for {data.applicantName}
            </p>
          </div>
          <Button variant="secondary" onClick={data.onClose} disabled={isSubmitting}>
            Close
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Applicant Details */}
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Applicant Details
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <DetailTile label="Name" value={data.applicantName} />
            <DetailTile label="Role" value={data.applicantRole} />
            <DetailTile label="Department" value={data.applicantDepartment} />
            <DetailTile label="Designation" value={data.applicantDesignation} />
          </div>
        </section>

        {/* Leave Details */}
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Leave Details
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <DetailTile
              label="From Date"
              value={formatDate(data.startDate)}
            />
            <DetailTile label="To Date" value={formatDate(data.endDate)} />
            <DetailTile
              label="Total Days"
              value={`${data.totalDays} day${data.totalDays === 1 ? "" : "s"}`}
            />
            <DetailTile label="Purpose" value={data.purpose} />
          </div>
        </section>

        {/* Submitted Form Data */}
        {formEntries.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Submitted Form Details
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              {formEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex flex-col gap-1 border-b border-slate-200 pb-2 last:border-0"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {formatFieldLabel(key)}
                  </p>
                  <p className="text-sm text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Approval Section */}
        {!disableActions && (
          <section className="space-y-4 border-t border-slate-200 pt-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {isAccountsActor ? "Accounts Entry" : "Approval Action"}
            </p>

            {decision === "PENDING" && isAccountsActor && (
              <div className="space-y-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <DetailTile
                    label="Nature of Leave"
                    value={data.leaveType || "Earned Leave"}
                  />
                  <DetailTile
                    label="Period"
                    value={`${formatDate(data.startDate)} to ${formatDate(data.endDate)}`}
                  />
                  <DetailTile
                    label="Leave Applied (Days)"
                    value={data.totalDays}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">
                    Balance as on date
                  </label>
                  <input
                    type="text"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="Enter leave balance"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="flex-1 bg-sky-700 text-white hover:bg-sky-800"
                  >
                    {isSubmitting ? "Processing..." : "Save Balance & Continue"}
                  </Button>
                </div>
              </div>
            )}

            {decision === "PENDING" && !isAccountsActor && (
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  onClick={() => setDecision("APPROVE")}
                  className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition-colors hover:bg-emerald-100"
                >
                  <p className="font-semibold text-emerald-900">Approve</p>
                  <p className="text-xs text-emerald-700">
                    {isFinalAuthorityActor
                      ? "Approve with comments and signature"
                      : "Recommend or process rejection"}
                  </p>
                </button>
                <button
                  onClick={() => setDecision("REJECT")}
                  className="rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-left transition-colors hover:bg-rose-100"
                >
                  <p className="font-semibold text-rose-900">Reject</p>
                  <p className="text-xs text-rose-700">Provide rejection remarks</p>
                </button>
              </div>
            )}

            {decision === "APPROVE" && !isAccountsActor && (
              <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                {!isFinalAuthorityActor && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">
                      Recommendation
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="recommendation"
                          value="RECOMMENDED"
                          checked={recommended === "RECOMMENDED"}
                          onChange={(e) =>
                            setRecommended(e.target.value as "RECOMMENDED")
                          }
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-slate-700">Recommended</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="recommendation"
                          value="NOT_RECOMMENDED"
                          checked={recommended === "NOT_RECOMMENDED"}
                          onChange={(e) =>
                            setRecommended(e.target.value as "NOT_RECOMMENDED")
                          }
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-slate-700">
                          Not Recommended
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Signature */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">
                    Signature
                  </label>
                  <input
                    type="text"
                    value={hodSignature}
                    onChange={(e) => setHodSignature(e.target.value)}
                    placeholder="Enter your signature"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                </div>

                {!isFinalAuthorityActor && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">
                      Decision Date
                    </label>
                    <input
                      type="date"
                      value={decisionDate}
                      onChange={(e) => setDecisionDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                )}

                {/* Remarks */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">
                    {isFinalAuthorityActor
                      ? "Comments"
                      : "Additional Remarks (Optional)"}
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={
                      isFinalAuthorityActor
                        ? "Add comments..."
                        : "Add any additional remarks..."
                    }
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                  <p className="text-xs text-slate-500">
                    {remarks.length}/500 characters
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {isSubmitting ? "Processing..." : "Confirm Approval"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setDecision("PENDING")}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}

            {decision === "REJECT" && !isAccountsActor && (
              <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                {/* Rejection Remarks */}
                <div className="space-y-2">
                  {isFinalAuthorityActor && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-900">
                        Signature
                      </label>
                      <input
                        type="text"
                        value={hodSignature}
                        onChange={(e) => setHodSignature(e.target.value)}
                        placeholder="Enter your signature"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                  )}
                  <label className="text-sm font-semibold text-slate-900">
                    Rejection Remarks
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Please provide reasons for rejection..."
                    rows={4}
                    maxLength={500}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                  <p className="text-xs text-slate-500">
                    {remarks.length}/500 characters
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleReject}
                    disabled={isSubmitting}
                    className="flex-1 bg-rose-600 text-white hover:bg-rose-700"
                  >
                    {isSubmitting ? "Processing..." : "Confirm Rejection"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setDecision("PENDING")}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </SurfaceCard>
    </div>
  );
};

const DetailTile = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
  </div>
);

const formatFieldLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
