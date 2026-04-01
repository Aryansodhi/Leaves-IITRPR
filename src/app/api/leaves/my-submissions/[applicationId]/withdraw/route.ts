import { cookies } from "next/headers";
import { ApprovalStatus, LeaveStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";
import { prisma } from "@/server/db/prisma";

const withStatus = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

const canWithdrawInTrail = (input: {
  status: LeaveStatus;
  startDate: Date;
  endDate: Date;
  approvalSteps: Array<{ status: ApprovalStatus }>;
}) => {
  if (
    input.status === LeaveStatus.APPROVED ||
    input.status === LeaveStatus.REJECTED ||
    input.status === LeaveStatus.CANCELLED
  ) {
    return false;
  }

  const hasPending = input.approvalSteps.some(
    (step) =>
      step.status === ApprovalStatus.PENDING ||
      step.status === ApprovalStatus.IN_REVIEW,
  );

  if (!hasPending) {
    return false;
  }

  // Ongoing workflow: allow withdrawal while trail is still active and leave
  // has not completely elapsed.
  const now = new Date();
  return input.endDate >= now;
};

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(_request: Request, context: Params) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);
    const { applicationId } = await context.params;

    if (!applicationId?.trim()) {
      throw withStatus("Application id is required.", 400);
    }

    const application = await prisma.leaveApplication.findFirst({
      where: {
        id: applicationId,
        applicantId: actor.userId,
      },
      include: {
        approvalSteps: true,
      },
    });

    if (!application) {
      throw withStatus("Leave application not found.", 404);
    }

    if (
      !canWithdrawInTrail({
        status: application.status,
        startDate: application.startDate,
        endDate: application.endDate,
        approvalSteps: application.approvalSteps,
      })
    ) {
      throw withStatus("This leave request can no longer be withdrawn.", 409);
    }

    const existingMeta =
      application.metadata &&
      typeof application.metadata === "object" &&
      !Array.isArray(application.metadata)
        ? (application.metadata as Prisma.JsonObject)
        : {};

    await prisma.$transaction([
      prisma.approvalStep.updateMany({
        where: {
          leaveApplicationId: application.id,
          status: { in: [ApprovalStatus.PENDING, ApprovalStatus.IN_REVIEW] },
        },
        data: {
          status: ApprovalStatus.SKIPPED,
          remarks: "Withdrawn by applicant before final approval.",
        },
      }),
      prisma.leaveApplication.update({
        where: { id: application.id },
        data: {
          status: LeaveStatus.CANCELLED,
          approvedAt: null,
          metadata: {
            ...existingMeta,
            withdrawal: {
              withdrawnAt: new Date().toISOString(),
              withdrawnById: actor.userId,
              reason: "Applicant withdrew before final approval.",
            },
          } as Prisma.InputJsonValue,
        },
      }),
    ]);

    const ipAddress = getRequestIp(_request);
    const userAgent = _request.headers.get("user-agent");
    await logAuditEvent({
      action: "WITHDRAW_LEAVE",
      entityType: "LEAVE_APPLICATION",
      entityId: application.id,
      referenceCode: application.referenceCode,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress,
      userAgent,
      details: {
        status: "CANCELLED",
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Leave request withdrawn successfully.",
    });
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
      { ok: false, message: "Unable to withdraw leave request." },
      { status: 400 },
    );
  }
}
