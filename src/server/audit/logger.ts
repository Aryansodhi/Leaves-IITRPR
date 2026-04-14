import crypto from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { getRequestIp } from "@/server/audit/ip";

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

export { getRequestIp };

let auditTableReady: boolean | null = null;

const ensureAuditLogTable = async () => {
  if (auditTableReady === true) return true;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" text PRIMARY KEY,
        "action" text NOT NULL,
        "entityType" text NOT NULL,
        "entityId" text,
        "referenceCode" text,
        "userId" text,
        "userEmail" text,
        "userName" text,
        "ipAddress" text,
        "userAgent" text,
        "details" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AuditLog_ipAddress_createdAt_idx" ON "AuditLog"("ipAddress", "createdAt")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AuditLog_referenceCode_idx" ON "AuditLog"("referenceCode")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId")`,
    );

    auditTableReady = true;
    return true;
  } catch (error) {
    auditTableReady = false;
    console.warn("Unable to ensure AuditLog table", error);
    return false;
  }
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

  try {
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
  } catch (error) {
    // Audit logging must never block the main request.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      const ready = await ensureAuditLogTable();
      if (!ready) return;
      try {
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
      } catch (retryError) {
        console.warn("Audit logging failed after table creation", retryError);
      }
      return;
    }

    console.warn("Audit logging failed", error);
  }
};
