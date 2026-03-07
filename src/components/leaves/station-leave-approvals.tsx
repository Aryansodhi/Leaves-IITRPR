"use client";

import { useEffect, useMemo, useState } from "react";

import {
  LeaveRequestDetailsModal,
  type LeaveRequestDetails,
} from "@/components/leaves/leave-request-details-modal";
import {
  EarnedLeaveApprovalModal,
  type EarnedLeaveApprovalData,
} from "@/components/leaves/earned-leave-approval-modal";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

type ApprovalRecord = LeaveRequestDetails & {
  applicationId: string;
  currentApprovalActor?: string | null;
  status: string;
  applicationStatus: string;
  appliedAt: string;
  applicant: {
    id: string;
    name: string;
    role: string;
    department: string;
    designation: string;
  };
  remarks?: string | null;
  actedAt?: string | null;
};

const matchesDateFilters = (
  value: string,
  fromDate: string,
  toDate: string,
) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`);
    if (parsed < from) return false;
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`);
    if (parsed > to) return false;
  }

  return true;
};

const statusTone = (value: string) => {
  if (value === "PENDING" || value === "IN_REVIEW") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (value === "APPROVED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (value === "REJECTED") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

const isJoiningReportRecord = (item: ApprovalRecord) =>
  (item.leaveTypeCode ?? "").toUpperCase() === "JR" ||
  item.leaveType.toLowerCase().includes("joining");

const isEarnedLeaveRecord = (item: ApprovalRecord) =>
  (item.leaveTypeCode ?? "").toUpperCase() === "EL" ||
  item.leaveType.toLowerCase().includes("earned");

export const StationLeaveApprovals = ({ role }: { role: string }) => {
  const [items, setItems] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [remarksById, setRemarksById] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<ApprovalRecord | null>(null);
  const [selectedEarnedLeave, setSelectedEarnedLeave] = useState<EarnedLeaveApprovalData | null>(null);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showPending, setShowPending] = useState(true);
  const [showHandled, setShowHandled] = useState(true);

  const loadItems = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/leaves/approvals", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: ApprovalRecord[];
      };

      if (!response.ok || !result.ok) {
        if (response.status === 403) {
          setItems([]);
          setError(null);
          return;
        }

        throw new Error(result.message ?? "Unable to load approvals.");
      }

      setItems(result.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load approvals.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const availableRoles = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.applicant.role))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [items],
  );

  const availableLeaveTypes = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.leaveType))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (roleFilter !== "ALL" && item.applicant.role !== roleFilter) {
          return false;
        }

        if (typeFilter !== "ALL" && item.leaveType !== typeFilter) {
          return false;
        }

        return matchesDateFilters(item.appliedAt, fromDate, toDate);
      }),
    [fromDate, items, roleFilter, toDate, typeFilter],
  );

  const pendingItems = useMemo(
    () =>
      filteredItems.filter(
        (item) => item.status === "PENDING" || item.status === "IN_REVIEW",
      ),
    [filteredItems],
  );

  const handledItems = useMemo(
    () =>
      filteredItems.filter(
        (item) => item.status !== "PENDING" && item.status !== "IN_REVIEW",
      ),
    [filteredItems],
  );

  const runDecision = async (
    applicationId: string,
    decision: "APPROVE" | "REJECT",
  ) => {
    setBusyId(applicationId);
    setError(null);

    try {
      const response = await fetch(`/api/leaves/approvals/${applicationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          remarks: remarksById[applicationId] || undefined,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to update request.");
      }

      await loadItems();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update request.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const openEarnedLeaveApproval = (item: ApprovalRecord) => {
    const handled = item.status !== "PENDING" && item.status !== "IN_REVIEW";
    const approvalData: EarnedLeaveApprovalData = {
      applicationId: item.applicationId,
      referenceCode: item.referenceCode,
      leaveType: item.leaveType,
      applicantName: item.applicant.name,
      applicantRole: item.applicant.role,
      applicantDepartment: item.applicant.department,
      applicantDesignation: item.applicant.designation,
      currentApprovalActor: item.currentApprovalActor ?? null,
      formData: item.formData ?? null,
      purpose: item.purpose,
      startDate: item.startDate,
      endDate: item.endDate,
      totalDays: item.totalDays,
      decisionRequired: !handled,
      viewerOnly: handled,
      onApprove: async (data) => {
        setBusyId(item.applicationId);
        setError(null);
        try {
          const response = await fetch(`/api/leaves/approvals/${item.applicationId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              decision: "APPROVE",
              remarks: data.remarks,
              recommended: data.recommended,
              hodSignature: data.hodSignature,
              accountsSignature: data.accountsSignature,
              balance: data.balance,
              decisionDate: data.decisionDate,
            }),
          });

          const result = (await response.json()) as {
            ok?: boolean;
            message?: string;
          };
          if (!response.ok || !result.ok) {
            throw new Error(result.message ?? "Unable to approve request.");
          }

          setSelectedEarnedLeave(null);
          await loadItems();
        } finally {
          setBusyId(null);
        }
      },
      onReject: async ({ remarks, hodSignature }) => {
        setBusyId(item.applicationId);
        setError(null);
        try {
          const response = await fetch(`/api/leaves/approvals/${item.applicationId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              decision: "REJECT",
              remarks,
              hodSignature,
            }),
          });

          const result = (await response.json()) as {
            ok?: boolean;
            message?: string;
          };
          if (!response.ok || !result.ok) {
            throw new Error(result.message ?? "Unable to reject request.");
          }

          setSelectedEarnedLeave(null);
          await loadItems();
        } finally {
          setBusyId(null);
        }
      },
      onClose: () => {
        setSelectedEarnedLeave(null);
      },
    };
    setSelectedEarnedLeave(approvalData);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard className="space-y-2 border-slate-200/80 p-5">
        <p className="text-xl font-semibold text-slate-900">Leave Approvals</p>
        <p className="text-sm text-slate-600">
          Role: {role.toUpperCase()} | Review submitted leave records, view full
          details, and approve only where an action is required.
        </p>
      </SurfaceCard>

      <SurfaceCard className="space-y-4 border-slate-200/80 p-5">
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showPending}
              onChange={(event) => setShowPending(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Pending / awaiting view
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showHandled}
              onChange={(event) => setShowHandled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Recently handled
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Filter by role</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">All roles</option>
              {availableRoles.map((itemRole) => (
                <option key={itemRole} value={itemRole}>
                  {itemRole}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">
              Filter by leave type
            </span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">All leave types</option>
              {availableLeaveTypes.map((leaveType) => (
                <option key={leaveType} value={leaveType}>
                  {leaveType}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-slate-200/80 p-4 text-sm text-slate-600">
            Showing {filteredItems.length} request
            {filteredItems.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Applied from</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Applied to</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label>
        </div>
      </SurfaceCard>

      {error ? (
        <SurfaceCard className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </SurfaceCard>
      ) : null}

      {showPending ? (
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pending approvals
          </p>
          {loading ? (
            <SurfaceCard className="p-4 text-sm text-slate-600">
              Loading requests...
            </SurfaceCard>
          ) : pendingItems.length === 0 ? (
            <SurfaceCard className="p-4 text-sm text-slate-600">
              No pending leave records mapped to you.
            </SurfaceCard>
          ) : (
            pendingItems.map((item) => (
              <SurfaceCard
                key={item.applicationId}
                className="space-y-3 border-slate-200/80 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {item.referenceCode}
                    </p>
                    <p className="text-xs text-slate-500">
                      Applied by {item.applicant.name} ({item.applicant.role}) -{" "}
                      {item.applicant.department}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone(item.status)}`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Leave window:</span>{" "}
                    {new Date(item.startDate).toLocaleDateString("en-GB")} to{" "}
                    {new Date(item.endDate).toLocaleDateString("en-GB")} (
                    {item.totalDays} days)
                  </p>
                  <p>
                    <span className="font-semibold">Leave type:</span>{" "}
                    {item.leaveType}
                  </p>
                  <p>
                    <span className="font-semibold">Processing mode:</span>{" "}
                    {item.decisionRequired ? "Approval required" : "View only"}
                  </p>
                  <p>
                    <span className="font-semibold">Purpose:</span>{" "}
                    {item.purpose}
                  </p>
                  <p>
                    <span className="font-semibold">Contact:</span>{" "}
                    {item.contactDuringLeave || "Not provided"}
                  </p>
                </div>

                {item.decisionRequired ? (
                  <textarea
                    value={remarksById[item.applicationId] ?? ""}
                    onChange={(event) =>
                      setRemarksById((prev) => ({
                        ...prev,
                        [item.applicationId]: event.target.value,
                      }))
                    }
                    placeholder="Remarks (optional)"
                    className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    This record has been routed to you for viewing only. No
                    approval action is required.
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (isEarnedLeaveRecord(item)) {
                        openEarnedLeaveApproval(item);
                      } else {
                        setSelected(item);
                      }
                    }}
                    disabled={busyId === item.applicationId}
                  >
                    View
                  </Button>
                  {item.decisionRequired ? (
                    <>
                      {!isJoiningReportRecord(item) && !isEarnedLeaveRecord(item) ? (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            runDecision(item.applicationId, "REJECT")
                          }
                          disabled={busyId === item.applicationId}
                        >
                          Reject
                        </Button>
                      ) : null}
                      {!isEarnedLeaveRecord(item) ? (
                        <Button
                          onClick={() =>
                            runDecision(item.applicationId, "APPROVE")
                          }
                          disabled={busyId === item.applicationId}
                        >
                          {busyId === item.applicationId
                            ? "Saving..."
                            : "Approve"}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </SurfaceCard>
            ))
          )}
        </section>
      ) : null}

      {showHandled ? (
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recently handled
          </p>
          {loading ? null : handledItems.length === 0 ? (
            <SurfaceCard className="p-4 text-sm text-slate-600">
              No handled requests yet.
            </SurfaceCard>
          ) : (
            handledItems.slice(0, 8).map((item) => (
              <SurfaceCard
                key={item.applicationId}
                className="border-slate-200/80 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {item.referenceCode}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (isEarnedLeaveRecord(item)) {
                          // handled items shown in read‑only mode
                          openEarnedLeaveApproval({
                            ...item,
                          } as ApprovalRecord);
                        } else {
                          setSelected(item);
                        }
                      }}
                    >
                      View
                    </Button>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  {item.applicant.name} | {item.leaveType} | {item.purpose} |{" "}
                  {item.actedAt ? new Date(item.actedAt).toLocaleString() : "-"}
                </p>
              </SurfaceCard>
            ))
          )}
        </section>
      ) : null}

      <LeaveRequestDetailsModal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        request={selected}
      />

      <EarnedLeaveApprovalModal
        isOpen={selectedEarnedLeave !== null}
        data={selectedEarnedLeave}
      />
    </div>
  );
};
