import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";
import { prisma } from "@/server/db/prisma";
import { decideLeaveApproval } from "@/server/routes/leaves/approvals";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const { applicationId } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);
    const rawPayload = (await request.json()) as Record<string, unknown> | null;
    const ipAddress = getRequestIp(request);
    const payload =
      rawPayload && typeof rawPayload === "object"
        ? { ...rawPayload, ipAddress }
        : { ipAddress };

    const result = await decideLeaveApproval(applicationId, payload, {
      userId: actor.userId,
    });

    const decision =
      payload && typeof payload.decision === "string" ? payload.decision : null;

    if (result?.ok && decision) {
      const application = await prisma.leaveApplication.findUnique({
        where: { id: applicationId },
        select: {
          referenceCode: true,
          leaveType: { select: { name: true, code: true } },
        },
      });

      const userAgent = request.headers.get("user-agent");
      await logAuditEvent({
        action: decision === "APPROVE" ? "APPROVE_LEAVE" : "REJECT_LEAVE",
        entityType: "LEAVE_APPLICATION",
        entityId: applicationId,
        referenceCode: application?.referenceCode ?? null,
        userId: actor.userId,
        userEmail: actor.email,
        userName: actor.name,
        ipAddress,
        userAgent,
        details: {
          decision,
          leaveType: application?.leaveType?.name ?? null,
          remarks:
            payload && typeof payload.remarks === "string"
              ? payload.remarks
              : null,
        },
      });
    }

    return NextResponse.json(result);
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
      { ok: false, message: "Unable to update approval." },
      { status: 400 },
    );
  }
}
