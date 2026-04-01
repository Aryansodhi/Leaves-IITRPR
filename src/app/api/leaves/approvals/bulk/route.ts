import { RoleKey } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";
import { prisma } from "@/server/db/prisma";
import { bulkDecideLeaveApprovals } from "@/server/routes/leaves/approvals";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token, {
      roles: [RoleKey.HOD, RoleKey.ACCOUNTS, RoleKey.DEAN],
    });
    const payload = await request.json();

    const result = await bulkDecideLeaveApprovals(payload, {
      userId: actor.userId,
    });

    const decision =
      payload && typeof payload.decision === "string" ? payload.decision : null;
    const successIds =
      result.data && Array.isArray(result.data.successes)
        ? result.data.successes
        : [];

    if (decision && successIds.length > 0) {
      const applications = await prisma.leaveApplication.findMany({
        where: { id: { in: successIds } },
        select: {
          id: true,
          referenceCode: true,
          leaveType: { select: { name: true } },
        },
      });

      const byId = new Map(applications.map((item) => [item.id, item]));
      const ipAddress = getRequestIp(request);
      const userAgent = request.headers.get("user-agent");

      await Promise.all(
        successIds.map((applicationId, index) => {
          const application = byId.get(applicationId);
          return logAuditEvent({
            action:
              decision === "APPROVE"
                ? "BULK_APPROVE_LEAVE"
                : "BULK_REJECT_LEAVE",
            entityType: "LEAVE_APPLICATION",
            entityId: applicationId,
            referenceCode: application?.referenceCode ?? null,
            userId: actor.userId,
            userEmail: actor.email,
            userName: actor.name,
            ipAddress,
            userAgent,
            createdAt: new Date(Date.now() + index),
            details: {
              decision,
              leaveType: application?.leaveType?.name ?? null,
              bulkCount: successIds.length,
            },
          });
        }),
      );
    }

    return NextResponse.json(
      {
        ok: result.ok,
        message: result.message,
        data: result.data,
      },
      { status: result.status },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof Error) {
      const status =
        "status" in error && typeof error.status === "number"
          ? error.status
          : 400;
      return NextResponse.json(
        { ok: false, message: error.message },
        { status },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Unable to process bulk approvals." },
      { status: 400 },
    );
  }
}
