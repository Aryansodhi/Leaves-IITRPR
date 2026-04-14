import { LeaveStatus, Prisma, RoleKey } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

const DEFAULT_RANGE_DAYS = 90;
const MAX_RANGE_DAYS = 366;

const parseDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clampRange = (from: Date, to: Date) => {
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / 86400000);
  if (diffDays <= MAX_RANGE_DAYS) return { from, to };

  const capped = new Date(from);
  capped.setUTCDate(capped.getUTCDate() + MAX_RANGE_DAYS);
  return { from, to: capped };
};

const formatDay = (date: Date) => date.toISOString().slice(0, 10);

const formatMonth = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const startOfWeek = (date: Date) => {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday as start
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
};

const buildSeriesKey = (date: Date, interval: string) => {
  if (interval === "month") return formatMonth(date);
  if (interval === "week") return formatDay(startOfWeek(date));
  return formatDay(date);
};

const normalizeStatus = (value: string) =>
  Object.values(LeaveStatus).includes(value as LeaveStatus)
    ? (value as LeaveStatus)
    : null;

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const url = new URL(request.url);
    const fromRaw = parseDate(url.searchParams.get("from"));
    const toRaw = parseDate(url.searchParams.get("to"));
    const interval = url.searchParams.get("interval") ?? "day";
    const statusRaw = url.searchParams.get("status");
    const leaveTypeRaw = url.searchParams.get("leaveType")?.trim();
    const departmentId = url.searchParams.get("departmentId")?.trim() ?? null;
    const roleKey = url.searchParams.get("roleKey")?.trim() ?? null;
    const includeDraft = url.searchParams.get("includeDraft") === "1";
    const allowLarge = url.searchParams.get("allowLarge") === "1";

    const now = new Date();
    const to = toRaw ?? now;
    const from =
      fromRaw ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * 86400000);
    const range = clampRange(from, to);

    const status = statusRaw ? normalizeStatus(statusRaw) : null;

    const dateFilter = {
      OR: [
        { submittedAt: { gte: range.from, lte: range.to } },
        { submittedAt: null, createdAt: { gte: range.from, lte: range.to } },
      ],
    };

    const where: Prisma.LeaveApplicationWhereInput = {
      ...(includeDraft ? {} : { status: { not: LeaveStatus.DRAFT } }),
      ...(status ? { status } : {}),
      ...(leaveTypeRaw
        ? {
            OR: [
              { leaveTypeId: leaveTypeRaw },
              {
                leaveType: {
                  code: { equals: leaveTypeRaw, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
      ...(departmentId ? { applicant: { departmentId } } : {}),
      ...(roleKey ? { applicant: { role: { key: roleKey as RoleKey } } } : {}),
      ...dateFilter,
    };

    const totalCount = await prisma.leaveApplication.count({ where });
    if (!allowLarge && totalCount > 5000) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Too many records for the selected range. Narrow the date range or add filters.",
        },
        { status: 413 },
      );
    }

    const items = await prisma.leaveApplication.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        referenceCode: true,
        status: true,
        createdAt: true,
        submittedAt: true,
        approvedAt: true,
        leaveType: { select: { name: true, code: true } },
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            department: { select: { id: true, name: true } },
            role: { select: { key: true, name: true } },
          },
        },
      },
    });

    const totals = {
      total: items.length,
      submitted: 0,
      underReview: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      returned: 0,
      draft: 0,
    };

    const byStatus = new Map<string, number>();
    const byLeaveType = new Map<
      string,
      { code: string; name: string; count: number }
    >();
    const byDepartment = new Map<
      string,
      { id: string | null; name: string; count: number }
    >();
    const byRole = new Map<
      string,
      { key: string | null; name: string | null; count: number }
    >();
    const series = new Map<string, number>();

    const approvalDurations: number[] = [];
    const pendingBuckets = {
      "0-2": 0,
      "3-7": 0,
      "8-14": 0,
      "15+": 0,
    };

    const nowTs = Date.now();

    for (const item of items) {
      const statusKey = item.status;
      byStatus.set(statusKey, (byStatus.get(statusKey) ?? 0) + 1);

      if (statusKey === LeaveStatus.SUBMITTED) totals.submitted += 1;
      if (statusKey === LeaveStatus.UNDER_REVIEW) totals.underReview += 1;
      if (statusKey === LeaveStatus.APPROVED) totals.approved += 1;
      if (statusKey === LeaveStatus.REJECTED) totals.rejected += 1;
      if (statusKey === LeaveStatus.CANCELLED) totals.cancelled += 1;
      if (statusKey === LeaveStatus.RETURNED) totals.returned += 1;
      if (statusKey === LeaveStatus.DRAFT) totals.draft += 1;

      const leaveTypeKey = item.leaveType.code;
      const leaveTypeEntry = byLeaveType.get(leaveTypeKey) ?? {
        code: item.leaveType.code,
        name: item.leaveType.name,
        count: 0,
      };
      leaveTypeEntry.count += 1;
      byLeaveType.set(leaveTypeKey, leaveTypeEntry);

      const deptId = item.applicant.department?.id ?? null;
      const deptName = item.applicant.department?.name ?? "Unassigned";
      const deptKey = deptId ?? "unassigned";
      const deptEntry = byDepartment.get(deptKey) ?? {
        id: deptId,
        name: deptName,
        count: 0,
      };
      deptEntry.count += 1;
      byDepartment.set(deptKey, deptEntry);

      const roleKeyValue = item.applicant.role?.key ?? null;
      const roleName = item.applicant.role?.name ?? null;
      const roleEntry = byRole.get(roleKeyValue ?? "unassigned") ?? {
        key: roleKeyValue,
        name: roleName,
        count: 0,
      };
      roleEntry.count += 1;
      byRole.set(roleKeyValue ?? "unassigned", roleEntry);

      const effectiveDate = item.submittedAt ?? item.createdAt;
      const seriesKey = buildSeriesKey(effectiveDate, interval);
      series.set(seriesKey, (series.get(seriesKey) ?? 0) + 1);

      if (
        item.status === LeaveStatus.APPROVED &&
        item.submittedAt &&
        item.approvedAt
      ) {
        const hours =
          (item.approvedAt.getTime() - item.submittedAt.getTime()) / 3600000;
        if (Number.isFinite(hours) && hours >= 0) approvalDurations.push(hours);
      }

      if (
        item.status === LeaveStatus.SUBMITTED ||
        item.status === LeaveStatus.UNDER_REVIEW ||
        item.status === LeaveStatus.RETURNED
      ) {
        const refDate = item.submittedAt ?? item.createdAt;
        const ageDays = Math.floor((nowTs - refDate.getTime()) / 86400000);
        if (ageDays <= 2) pendingBuckets["0-2"] += 1;
        else if (ageDays <= 7) pendingBuckets["3-7"] += 1;
        else if (ageDays <= 14) pendingBuckets["8-14"] += 1;
        else pendingBuckets["15+"] += 1;
      }
    }

    const avgApprovalHours = approvalDurations.length
      ? approvalDurations.reduce((sum, value) => sum + value, 0) /
        approvalDurations.length
      : null;

    const response = {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        filters: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          interval,
          status,
          leaveType: leaveTypeRaw ?? null,
          departmentId,
          roleKey,
          includeDraft,
          totalCount,
        },
        totals,
        avgApprovalHours,
        avgApprovalDays: avgApprovalHours ? avgApprovalHours / 24 : null,
        pendingAging: Object.entries(pendingBuckets).map(([bucket, count]) => ({
          bucket,
          count,
        })),
        byStatus: Array.from(byStatus.entries())
          .map(([key, count]) => ({ status: key, count }))
          .sort((a, b) => b.count - a.count),
        byLeaveType: Array.from(byLeaveType.values()).sort(
          (a, b) => b.count - a.count,
        ),
        byDepartment: Array.from(byDepartment.values()).sort(
          (a, b) => b.count - a.count,
        ),
        byRole: Array.from(byRole.values()).sort((a, b) => b.count - a.count),
        series: Array.from(series.entries())
          .map(([bucket, count]) => ({ bucket, count }))
          .sort((a, b) => a.bucket.localeCompare(b.bucket)),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Unable to generate statistics." },
      { status: 400 },
    );
  }
}
