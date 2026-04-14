"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  LeaveRequestDetailsModal,
  type LeaveRequestDetails,
} from "@/components/leaves/leave-request-details-modal";

type TraceResponse = {
  application: {
    id: string;
    referenceCode: string;
    status: string;
    submittedAt: string | null;
    createdAt: string;
    leaveType: { name: string; code: string };
    applicant: {
      name: string;
      email: string;
      designation?: string | null;
      department?: { name: string } | null;
      role?: { key: string } | null;
    };
    approvalSteps: Array<{
      id: string;
      sequence: number;
      actor: string;
      status: string;
      remarks: string | null;
      actedAt: string | null;
      assignedTo?: { name: string; email: string } | null;
      actedBy?: { name: string; email: string } | null;
      escalatedTo?: { name: string; email: string } | null;
    }>;
  };
  request: LeaveRequestDetails;
  auditLogs: Array<{
    id: string;
    action: string;
    userName: string | null;
    userEmail: string | null;
    ipAddress: string | null;
    createdAt: string;
    details: Record<string, unknown> | null;
  }>;
};

export const ApplicationTracker = () => {
  const [referenceCode, setReferenceCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TraceResponse | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<LeaveRequestDetails | null>(null);

  const handleLookup = async () => {
    if (!referenceCode.trim()) {
      setError("Enter a leave application reference code.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/admin/application-trace?referenceCode=${encodeURIComponent(
          referenceCode.trim(),
        )}`,
        { method: "GET", cache: "no-store" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        data?: TraceResponse;
        message?: string;
      };

      if (!response.ok || !data.ok || !data.data) {
        throw new Error(data.message ?? "Unable to load application trace.");
      }

      setResult(data.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load application trace.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SurfaceCard className="space-y-4 border-slate-200/80 p-5">
      <div>
        <p className="text-base font-semibold text-slate-900">
          Track an application
        </p>
        <p className="text-xs text-slate-500">
          Enter a leave reference code to view approval trail and audit logs.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={referenceCode}
          onChange={(event) => setReferenceCode(event.target.value)}
          placeholder="Example: EL-2026-AB12CD"
          className="min-w-65 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
        />
        <Button onClick={handleLookup} disabled={loading}>
          {loading ? "Searching..." : "Track"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!result ? null : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Application
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {result.application.referenceCode}
              </p>
              <p className="text-sm text-slate-600">
                {result.application.leaveType.name} |{" "}
                {result.application.status}
              </p>
              {result.request.applicantIp ? (
                <p className="mt-1 text-xs text-slate-500">
                  Applicant IP: {result.request.applicantIp}
                </p>
              ) : null}
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedRequest(result.request)}
                >
                  View full form
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Applicant
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {result.application.applicant.name}
              </p>
              <p className="text-sm text-slate-600">
                {result.application.applicant.email} |{" "}
                {result.application.applicant.department?.name ??
                  "No department"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Approval trail
            </p>
            <div className="mt-3 space-y-2">
              {(result.request.approvalTrail ?? []).map((step) => (
                <div
                  key={`${step.sequence}-${step.actor}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                >
                  <p className="font-semibold text-slate-900">
                    Step {step.sequence} | {step.actor} | {step.status}
                  </p>
                  <p>Assigned to: {step.assignedTo ?? "-"}</p>
                  <p>Acted by: {step.actedBy ?? "-"}</p>
                  <p>
                    Acted at:{" "}
                    {step.actedAt
                      ? new Date(step.actedAt).toLocaleString()
                      : "-"}
                  </p>
                  <p>IP: {step.ipAddress ?? "-"}</p>
                  <p>Remarks: {step.remarks ?? "-"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Audit logs
            </p>
            {result.auditLogs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                No audit logs found for this application.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {result.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  >
                    <p className="font-semibold text-slate-900">{log.action}</p>
                    <p>
                      {new Date(log.createdAt).toLocaleString()} |{" "}
                      {log.userName ?? "Unknown"}
                      {log.userEmail ? ` (${log.userEmail})` : ""}
                    </p>
                    <p>IP: {log.ipAddress ?? "-"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <LeaveRequestDetailsModal
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        displayMode="form-only"
      />
    </SurfaceCard>
  );
};
