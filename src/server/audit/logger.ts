import crypto from "node:crypto";

import { prisma } from "@/server/db/prisma";

export type AuditEventInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  referenceCode?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
  createdAt?: Date;
};

export const getRequestIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
};

export const logAuditEvent = async (input: AuditEventInput) => {
  const timestamp = input.createdAt ?? new Date();
  const idSource = `${timestamp.toISOString()}|${input.ipAddress ?? "unknown"}|${input.userId ?? "anonymous"}`;
  const id = crypto.createHash("sha256").update(idSource).digest("hex");

  const auditLog = (
    prisma as unknown as {
      auditLog?: { create: (args: unknown) => Promise<unknown> };
    }
  ).auditLog;

  if (!auditLog) return;

  await auditLog.create({
    data: {
      id,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      referenceCode: input.referenceCode ?? null,
      userId: input.userId ?? null,
      userEmail: input.userEmail ?? null,
      userName: input.userName ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      details: input.details ?? undefined,
      createdAt: timestamp,
    },
  });
};
