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

const ensureAuditLogGuards = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION public.auditlog_guard_insert()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF COALESCE(NEW.details->>'_source', '') <> 'system-audit' THEN
        RAISE EXCEPTION 'Manual audit inserts are not allowed';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION public.auditlog_guard_immutable()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'AuditLog is immutable: updates are not allowed';
      ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'AuditLog is immutable: deletes are not allowed';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);

  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS "AuditLog_block_manual_insert" ON "AuditLog"`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "AuditLog_block_manual_insert" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION public.auditlog_guard_insert()`,
  );

  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS "AuditLog_block_mutation" ON "AuditLog"`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "AuditLog_block_mutation" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION public.auditlog_guard_immutable()`,
  );
};

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

    await ensureAuditLogGuards();

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
  // Use random UUID to avoid collisions during rapid multi-action flows
  // (for example bulk approvals from the same actor/IP in the same millisecond).
  const id = crypto.randomUUID();

  const auditLog = (
    prisma as unknown as {
      auditLog?: { create: (args: unknown) => Promise<unknown> };
    }
  ).auditLog;

  if (!auditLog) return;

  const details = {
    ...(input.details ?? {}),
    _source: "system-audit",
  };

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
        details,
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
        await ensureAuditLogGuards();
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
            details,
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
