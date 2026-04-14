import crypto from "node:crypto";

import { ApprovalStatus, Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

export type DerivedAuditQuery = {
  userId?: string | null;
  userQuery?: string | null;
  reference?: string | null;
  from?: Date | null;
  to?: Date | null;
  limit: number;
  offset: number;
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

const hashId = (source: string) =>
  crypto.createHash("sha256").update(source).digest("hex");

const buildDateFilter = (
  from: Date | null | undefined,
  to: Date | null | undefined,
) =>
  from || to
    ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
    : undefined;

export const loadDerivedAuditLogs = async (
  query: DerivedAuditQuery,
): Promise<{ total: number; logs: AuditLogRecord[] }> => {
  const take = Math.min(query.limit + query.offset, 600);

  const containsUser = query.userQuery?.trim()
    ? {
        contains: query.userQuery.trim(),
        mode: "insensitive" as const,
      }
    : null;

  const referenceFilter = query.reference?.trim()
    ? {
        contains: query.reference.trim(),
        mode: "insensitive" as const,
      }
    : null;

  const submissionWhere: Prisma.LeaveApplicationWhereInput = {
    status: { not: "DRAFT" },
    ...(query.userId ? { applicantId: query.userId } : {}),
    ...(referenceFilter ? { referenceCode: referenceFilter } : {}),
    ...(containsUser
      ? {
          applicant: {
            OR: [{ email: containsUser }, { name: containsUser }],
          },
        }
      : {}),
    ...(query.from || query.to
      ? {
          OR: [
            { submittedAt: buildDateFilter(query.from, query.to) },
            {
              submittedAt: null,
              createdAt: buildDateFilter(query.from, query.to),
            },
          ],
        }
      : {}),
  };

  const approvalWhere: Prisma.ApprovalStepWhereInput = {
    actedAt: { not: null, ...(buildDateFilter(query.from, query.to) ?? {}) },
    status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
    ...(query.userId ? { actedById: query.userId } : {}),
    ...(containsUser
      ? {
          actedBy: {
            OR: [{ email: containsUser }, { name: containsUser }],
          },
        }
      : {}),
    leaveApplication: {
      status: { not: "DRAFT" },
      ...(referenceFilter ? { referenceCode: referenceFilter } : {}),
    },
  };

  const [submissionTotal, approvalTotal, submissions, approvals] =
    await Promise.all([
      prisma.leaveApplication.count({ where: submissionWhere }),
      prisma.approvalStep.count({ where: approvalWhere }),
      prisma.leaveApplication.findMany({
        where: submissionWhere,
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take,
        select: {
          id: true,
          referenceCode: true,
          status: true,
          createdAt: true,
          submittedAt: true,
          cancelledAt: true,
          leaveType: { select: { name: true, code: true } },
          applicant: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.approvalStep.findMany({
        where: approvalWhere,
        orderBy: [{ actedAt: "desc" }, { updatedAt: "desc" }],
        take,
        select: {
          id: true,
          actor: true,
          status: true,
          remarks: true,
          actedAt: true,
          actedBy: { select: { id: true, name: true, email: true } },
          leaveApplication: {
            select: {
              id: true,
              referenceCode: true,
              status: true,
              leaveType: { select: { name: true, code: true } },
              applicant: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
    ]);

  const mappedSubmissions: AuditLogRecord[] = submissions.map((item) => {
    const timestamp = item.submittedAt ?? item.createdAt;
    const action =
      item.cancelledAt || item.status === "CANCELLED"
        ? "CANCEL_APPLICATION"
        : "SUBMIT_APPLICATION";
    const details: Record<string, unknown> = {
      status: item.status,
      leaveType: item.leaveType.code,
    };

    return {
      id: hashId(`derived:submission:${item.id}:${timestamp.toISOString()}`),
      action,
      entityType: "LEAVE_APPLICATION",
      entityId: item.id,
      referenceCode: item.referenceCode,
      userId: item.applicant.id,
      userEmail: item.applicant.email,
      userName: item.applicant.name,
      ipAddress: null,
      userAgent: null,
      details,
      createdAt: timestamp.toISOString(),
    };
  });

  const mappedApprovals: AuditLogRecord[] = approvals.map((step) => {
    const actedAt = step.actedAt ?? new Date();
    const decision =
      step.status === ApprovalStatus.APPROVED ? "APPROVE" : "REJECT";
    return {
      id: hashId(`derived:decision:${step.id}:${actedAt.toISOString()}`),
      action: decision === "APPROVE" ? "APPROVE_LEAVE" : "REJECT_LEAVE",
      entityType: "LEAVE_APPLICATION",
      entityId: step.leaveApplication.id,
      referenceCode: step.leaveApplication.referenceCode,
      userId: step.actedBy?.id ?? null,
      userEmail: step.actedBy?.email ?? null,
      userName: step.actedBy?.name ?? null,
      ipAddress: null,
      userAgent: null,
      details: {
        decision,
        stepActor: step.actor,
        remarks: step.remarks ?? null,
        leaveType: step.leaveApplication.leaveType.code,
        applicant: {
          id: step.leaveApplication.applicant.id,
          name: step.leaveApplication.applicant.name,
          email: step.leaveApplication.applicant.email,
        },
      },
      createdAt: actedAt.toISOString(),
    };
  });

  const merged = [...mappedSubmissions, ...mappedApprovals]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(query.offset, query.offset + query.limit);

  return {
    total: submissionTotal + approvalTotal,
    logs: merged,
  };
};
