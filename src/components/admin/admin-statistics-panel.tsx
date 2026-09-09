"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

type MetaResponse = {
  ok?: boolean;
  data?: {
    leaveTypes: Array<{ id: string; name: string; code: string }>;
    departments: Array<{ id: string; name: string }>;
    roles: Array<{ key: string; name: string }>;
    users: Array<{
      id: string;
      name: string;
      email: string;
      departmentId: string | null;
      roleKey: string | null;
    }>;
  };
  message?: string;
};

type StatsResponse = {
  ok?: boolean;
  data?: {
    generatedAt: string;
    filters: {
      from: string;
      to: string;
      interval: string;
      status: string | null;
      leaveType: string | null;
      departmentId: string | null;
      roleKey: string | null;
      userId: string | null;
      includeDraft: boolean;
      totalCount: number;
    };
    totals: {
      total: number;
      submitted: number;
      underReview: number;
      approved: number;
      rejected: number;
      cancelled: number;
      returned: number;
      draft: number;
    };
    avgApprovalHours: number | null;
    avgApprovalDays: number | null;
    pendingAging: Array<{ bucket: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    byLeaveType: Array<{ code: string; name: string; count: number }>;
    byDepartment: Array<{ id: string | null; name: string; count: number }>;
    byRole: Array<{ key: string | null; name: string | null; count: number }>;
    series: Array<{ bucket: string; count: number }>;
  };
  message?: string;
};

const LEAVE_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "CANCELLED",
  "DRAFT",
] as const;

const INTERVALS = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

const formatNumber = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toLocaleString();
};

const formatAvg = (value: number | null, unit: string) => {
  if (value === null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)} ${unit}`;
};

const downloadBlob = (content: string, fileName: string, mime: string) => {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const escapeCsv = (value: string) => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const buildCsv = (stats: NonNullable<StatsResponse["data"]>) => {
  const rows: string[][] = [];
  rows.push(["Section", "Key", "Value"]);

  rows.push(["Meta", "Generated at", stats.generatedAt]);
  rows.push(["Meta", "Range", `${stats.filters.from} to ${stats.filters.to}`]);
  rows.push(["Meta", "Interval", stats.filters.interval]);

  rows.push(["Summary", "Total applications", String(stats.totals.total)]);
  rows.push(["Summary", "Submitted", String(stats.totals.submitted)]);
  rows.push(["Summary", "Under review", String(stats.totals.underReview)]);
  rows.push(["Summary", "Approved", String(stats.totals.approved)]);
  rows.push(["Summary", "Rejected", String(stats.totals.rejected)]);
  rows.push(["Summary", "Returned", String(stats.totals.returned)]);
  rows.push(["Summary", "Cancelled", String(stats.totals.cancelled)]);
  rows.push(["Summary", "Draft", String(stats.totals.draft)]);
  rows.push([
    "Summary",
    "Average approval (hours)",
    stats.avgApprovalHours ? stats.avgApprovalHours.toFixed(2) : "-",
  ]);

  stats.byStatus.forEach((item) =>
    rows.push(["Status", item.status, String(item.count)]),
  );

  stats.byLeaveType.forEach((item) =>
    rows.push([
      "Leave type",
      `${item.name} (${item.code})`,
      String(item.count),
    ]),
  );

  stats.byDepartment.forEach((item) =>
    rows.push(["Department", item.name, String(item.count)]),
  );

  stats.byRole.forEach((item) =>
    rows.push([
      "Role",
      item.name ?? item.key ?? "Unassigned",
      String(item.count),
    ]),
  );

  stats.pendingAging.forEach((item) =>
    rows.push(["Pending aging", item.bucket, String(item.count)]),
  );

  stats.series.forEach((item) =>
    rows.push(["Trend", item.bucket, String(item.count)]),
  );

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
};

type StatisticsUserOption = NonNullable<MetaResponse["data"]>["users"][number];

const formatUserOption = (user: StatisticsUserOption) =>
  `${user.name} (${user.email})`;

export const AdminStatisticsPanel = () => {
  const [meta, setMeta] = useState<MetaResponse["data"] | null>(null);
  const [interval, setInterval] = useState("day");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [userId, setUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
  const [includeDraft, setIncludeDraft] = useState(false);
  const [stats, setStats] = useState<StatsResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const response = await fetch("/api/admin/statistics/meta", {
          method: "GET",
          cache: "no-store",
        });
        const result = (await response.json()) as MetaResponse;
        if (!response.ok || !result.ok || !result.data) {
          throw new Error(result.message ?? "Unable to load metadata.");
        }
        setMeta(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load metadata.",
        );
      }
    };

    void loadMeta();
  }, []);

  const eligibleUsers = useMemo(() => {
    return (meta?.users ?? []).filter((user) => {
      if (departmentId && user.departmentId !== departmentId) return false;
      if (roleKey && user.roleKey !== roleKey) return false;
      return true;
    });
  }, [departmentId, meta?.users, roleKey]);

  const eligibleUserOptions = useMemo(
    () =>
      eligibleUsers.map((user) => ({
        ...user,
        label: formatUserOption(user),
      })),
    [eligibleUsers],
  );

  const visibleUserOptions = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    const options = query
      ? eligibleUserOptions.filter(
          (user) =>
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query),
        )
      : eligibleUserOptions;

    return options.slice(0, 8);
  }, [eligibleUserOptions, userSearch]);

  useEffect(() => {
    if (!userId) return;
    if (!eligibleUsers.some((user) => user.id === userId)) {
      setUserId("");
      setUserSearch("");
    }
  }, [eligibleUsers, userId]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (fromDate) {
      const from = new Date(`${fromDate}T00:00:00`);
      if (!Number.isNaN(from.getTime())) params.set("from", from.toISOString());
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59.999`);
      if (!Number.isNaN(to.getTime())) params.set("to", to.toISOString());
    }
    if (interval) params.set("interval", interval);
    if (status) params.set("status", status);
    if (leaveType) params.set("leaveType", leaveType);
    if (departmentId) params.set("departmentId", departmentId);
    if (roleKey) params.set("roleKey", roleKey);
    if (userId) params.set("userId", userId);
    if (includeDraft) params.set("includeDraft", "1");
    return params;
  };

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = buildParams();
      const response = await fetch(
        `/api/admin/statistics?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const result = (await response.json()) as StatsResponse;
      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message ?? "Unable to generate statistics.");
      }
      setStats(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to generate statistics.",
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!stats) return;
    const csv = buildCsv(stats);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(
      csv,
      `leave-statistics-${stamp}.csv`,
      "text/csv;charset=utf-8",
    );
  };

  const downloadJson = () => {
    if (!stats) return;
    const json = JSON.stringify(stats, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(json, `leave-statistics-${stamp}.json`, "application/json");
  };

  const filterSummary = useMemo(() => {
    if (!stats) return "No report generated yet.";
    return `Range: ${stats.filters.from} to ${stats.filters.to} | Interval: ${stats.filters.interval}`;
  }, [stats]);

  return (
    <SurfaceCard className="space-y-5 border-slate-200/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">
            Statistics & reports
          </p>
          <p className="text-xs text-slate-500">
            Filter applications, pick an interval, and export the report.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={loadStats} disabled={loading}>
            {loading ? "Generating..." : "Generate report"}
          </Button>
          <Button variant="secondary" onClick={downloadCsv} disabled={!stats}>
            Download CSV
          </Button>
          <Button variant="secondary" onClick={downloadJson} disabled={!stats}>
            Download JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">Interval</span>
          <select
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            {INTERVALS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All statuses</option>
            {LEAVE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">Leave type</span>
          <select
            value={leaveType}
            onChange={(event) => setLeaveType(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All leave types</option>
            {(meta?.leaveTypes ?? []).map((item) => (
              <option key={item.id} value={item.code}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">Department</span>
          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All departments</option>
            {(meta?.departments ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">Role</span>
          <select
            value={roleKey}
            onChange={(event) => setRoleKey(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All roles</option>
            {(meta?.roles ?? []).map((item) => (
              <option key={item.key} value={item.key}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">User</span>
          <div className="relative">
            <input
              value={userSearch}
              onChange={(event) => {
                setUserSearch(event.target.value);
                setUserId("");
                setIsUserSearchOpen(true);
              }}
              onFocus={() => setIsUserSearchOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setIsUserSearchOpen(false), 120);
              }}
              placeholder="Search by name or email"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
            {isUserSearchOpen && visibleUserOptions.length > 0 ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {visibleUserOptions.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setUserId(user.id);
                      setUserSearch(user.label);
                      setIsUserSearchOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  >
                    <span className="block truncate font-medium">
                      {user.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {user.email}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <span className="block text-[11px] text-slate-500">
            Suggestions match the selected department and role. Select a
            suggestion to filter by that user.
          </span>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={includeDraft}
            onChange={(event) => setIncludeDraft(event.target.checked)}
          />
          Include drafts
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        {filterSummary}
      </div>

      {!stats ? null : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Total applications
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatNumber(stats.totals.total)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Approved
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatNumber(stats.totals.approved)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Under review
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatNumber(stats.totals.underReview)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Rejected
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatNumber(stats.totals.rejected)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Average approval time
              </p>
              <p className="text-base font-semibold text-slate-900">
                {formatAvg(stats.avgApprovalHours, "hours")}
              </p>
              <p className="text-xs text-slate-500">
                {formatAvg(stats.avgApprovalDays, "days")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Pending aging
              </p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                {stats.pendingAging.map((item) => (
                  <div key={item.bucket} className="flex justify-between">
                    <span>{item.bucket} days</span>
                    <span className="font-semibold">
                      {formatNumber(item.count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status breakdown
              </p>
              <div className="mt-3 space-y-2">
                {stats.byStatus.map((item) => (
                  <div
                    key={item.status}
                    className="flex justify-between text-sm"
                  >
                    <span>{item.status.replace(/_/g, " ")}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Leave types
              </p>
              <div className="mt-3 space-y-2">
                {stats.byLeaveType.map((item) => (
                  <div key={item.code} className="flex justify-between text-sm">
                    <span>
                      {item.name} ({item.code})
                    </span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Departments
              </p>
              <div className="mt-3 space-y-2">
                {stats.byDepartment.map((item) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Roles
              </p>
              <div className="mt-3 space-y-2">
                {stats.byRole.map((item) => (
                  <div
                    key={item.key ?? item.name ?? "unknown"}
                    className="flex justify-between text-sm"
                  >
                    <span>{item.name ?? item.key ?? "Unassigned"}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Submission trend
            </p>
            {stats.series.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                No activity in this range.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {stats.series.map((item) => (
                  <div
                    key={item.bucket}
                    className="flex justify-between text-sm"
                  >
                    <span>{item.bucket}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SurfaceCard>
  );
};
