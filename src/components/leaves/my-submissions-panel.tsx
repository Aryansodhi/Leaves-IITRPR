"use client";

import { useEffect, useMemo, useState } from "react";

import {
  LeaveRequestDetailsModal,
  type LeaveRequestDetails,
} from "@/components/leaves/leave-request-details-modal";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

type SubmissionItem = LeaveRequestDetails & {
  id: string;
};

const isPendingStatus = (status: string) =>
  status === "SUBMITTED" || status === "UNDER_REVIEW";

const isApprovedStatus = (status: string) => status === "APPROVED";

const matchesDateFilters = (
  submittedAt: string,
  fromDate: string,
  toDate: string,
) => {
  const submitted = new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) return false;

  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`);
    if (submitted < from) return false;
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`);
    if (submitted > to) return false;
  }

  return true;
};

export const MySubmissionsPanel = () => {
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SubmissionItem | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [showApproved, setShowApproved] = useState(true);
  const [showOther, setShowOther] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/leaves/my-submissions", {
          method: "GET",
          cache: "no-store",
        });
        const result = (await response.json()) as {
          ok?: boolean;
          message?: string;
          data?: { items?: SubmissionItem[] };
        };

        if (!response.ok || !result.ok) {
          throw new Error(
            result.message ?? "Unable to load leave submissions.",
          );
        }

        setItems(result.data?.items ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load leave submissions.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredItems = useMemo(
    () =>
      items.filter((entry) => {
        if (!matchesDateFilters(entry.submittedAt, fromDate, toDate)) {
          return false;
        }

        if (isPendingStatus(entry.status)) {
          return showPending;
        }

        if (isApprovedStatus(entry.status)) {
          return showApproved;
        }

        return showOther;
      }),
    [fromDate, items, showApproved, showOther, showPending, toDate],
  );

  const pendingItems = useMemo(
    () => filteredItems.filter((entry) => isPendingStatus(entry.status)),
    [filteredItems],
  );

  const approvedItems = useMemo(
    () => filteredItems.filter((entry) => isApprovedStatus(entry.status)),
    [filteredItems],
  );

  const otherItems = useMemo(
    () =>
      filteredItems.filter(
        (entry) =>
          !isPendingStatus(entry.status) && !isApprovedStatus(entry.status),
      ),
    [filteredItems],
  );

  const renderRow = (entry: SubmissionItem) => (
    <div
      key={entry.id}
      className="rounded-xl border border-slate-200/80 px-4 py-3 text-xs text-slate-700"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-semibold text-slate-900">{entry.referenceCode}</p>
          <p>
            {entry.leaveType} |{" "}
            {new Date(entry.startDate).toLocaleDateString("en-GB")} to{" "}
            {new Date(entry.endDate).toLocaleDateString("en-GB")} (
            {entry.totalDays} days)
          </p>
          <p>
            Status: {entry.status}
            {entry.currentApprover
              ? ` | Pending with: ${entry.currentApprover}`
              : ""}
          </p>
          <p>
            Submitted: {new Date(entry.submittedAt).toLocaleDateString("en-GB")}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setSelected(entry)}>
          View
        </Button>
      </div>
    </div>
  );

  return (
    <section className="space-y-4">
      <SurfaceCard className="space-y-2 border-slate-200/80 p-5">
        <p className="text-lg font-semibold text-slate-900">
          My leave submissions
        </p>
        <p className="text-sm text-slate-600">
          Track pending approvals and view approved or older leave requests.
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
            Pending approval
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showApproved}
              onChange={(event) => setShowApproved(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Approved
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOther}
              onChange={(event) => setShowOther(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Rejected / other
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Submitted from</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Submitted to</span>
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

      <div className="grid gap-4 xl:grid-cols-3">
        <SurfaceCard className="space-y-3 border-slate-200/80 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pending approvals
          </p>
          {loading ? (
            <p className="text-sm text-slate-500">
              Loading pending requests...
            </p>
          ) : pendingItems.length === 0 ? (
            <p className="text-sm text-slate-500">No pending approvals.</p>
          ) : (
            <div className="space-y-2">{pendingItems.map(renderRow)}</div>
          )}
        </SurfaceCard>

        <SurfaceCard className="space-y-3 border-slate-200/80 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Approved submissions
          </p>
          {loading ? (
            <p className="text-sm text-slate-500">
              Loading previous submissions...
            </p>
          ) : approvedItems.length === 0 ? (
            <p className="text-sm text-slate-500">No approved submissions.</p>
          ) : (
            <div className="space-y-2">{approvedItems.map(renderRow)}</div>
          )}
        </SurfaceCard>

        <SurfaceCard className="space-y-3 border-slate-200/80 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rejected / old submissions
          </p>
          {loading ? (
            <p className="text-sm text-slate-500">
              Loading previous submissions...
            </p>
          ) : otherItems.length === 0 ? (
            <p className="text-sm text-slate-500">No other submissions yet.</p>
          ) : (
            <div className="space-y-2">{otherItems.map(renderRow)}</div>
          )}
        </SurfaceCard>
      </div>

      <LeaveRequestDetailsModal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        request={selected}
      />
    </section>
  );
};
