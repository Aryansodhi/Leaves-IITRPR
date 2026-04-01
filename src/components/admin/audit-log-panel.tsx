"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

type UserOption = {
  id: string;
  name: string;
  email: string;
  role?: { key: string } | null;
};

type AuditLogRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  referenceCode: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export const AuditLogPanel = () => {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch("/api/admin/audit/users", {
          method: "GET",
          cache: "no-store",
        });
        const result = (await response.json()) as {
          ok?: boolean;
          data?: UserOption[];
          message?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "Unable to load users.");
        }

        setUsers(result.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load users.");
      }
    };

    void loadUsers();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedUserId) params.set("userId", selectedUserId);
      if (userQuery.trim()) params.set("user", userQuery.trim());
      if (ipAddress.trim()) params.set("ip", ipAddress.trim());
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) params.set("to", new Date(toDate).toISOString());

      const response = await fetch(`/api/admin/audit?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        data?: { logs?: AuditLogRecord[]; total?: number };
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to load audit logs.");
      }

      setLogs(result.data?.logs ?? []);
      setTotal(result.data?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load audit logs.",
      );
    } finally {
      setLoading(false);
    }
  };

  const filtersSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedUserId) {
      const user = users.find((item) => item.id === selectedUserId);
      parts.push(user ? `${user.name} (${user.email})` : "Selected user");
    }
    if (userQuery.trim()) parts.push(`User: ${userQuery.trim()}`);
    if (ipAddress.trim()) parts.push(`IP: ${ipAddress.trim()}`);
    if (fromDate || toDate) {
      parts.push(`Range: ${fromDate || "-"} to ${toDate || "-"}`);
    }
    return parts.length ? parts.join(" | ") : "No filters applied";
  }, [fromDate, ipAddress, selectedUserId, toDate, userQuery, users]);

  return (
    <SurfaceCard className="space-y-4 border-slate-200/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">Audit logs</p>
          <p className="text-xs text-slate-500">
            Filter by user, IP address, and time interval.
          </p>
        </div>
        <Button onClick={loadLogs} disabled={loading}>
          {loading ? "Loading..." : "Apply filters"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">Select user</span>
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">User search</span>
          <input
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            placeholder="Name or email"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">IP address</span>
          <input
            value={ipAddress}
            onChange={(event) => setIpAddress(event.target.value)}
            placeholder="e.g. 10.0.0.12"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-600">
            <span className="font-medium text-slate-800">From</span>
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span className="font-medium text-slate-800">To</span>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        {filtersSummary} | {total} log(s)
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-slate-600">No audit logs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-slate-700">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2">Time</th>
                <th className="border-b border-slate-200 px-3 py-2">Action</th>
                <th className="border-b border-slate-200 px-3 py-2">User</th>
                <th className="border-b border-slate-200 px-3 py-2">IP</th>
                <th className="border-b border-slate-200 px-3 py-2">
                  Reference
                </th>
                <th className="border-b border-slate-200 px-3 py-2">Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {item.action}
                  </td>
                  <td className="px-3 py-2">
                    {item.userName || "-"}
                    <span className="text-slate-400">
                      {item.userEmail ? ` (${item.userEmail})` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2">{item.ipAddress ?? "-"}</td>
                  <td className="px-3 py-2">{item.referenceCode ?? "-"}</td>
                  <td className="px-3 py-2">
                    {item.entityType}
                    {item.entityId ? ` • ${item.entityId}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SurfaceCard>
  );
};
