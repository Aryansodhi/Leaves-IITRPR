import { cookies } from "next/headers";
import { LeaveStatus, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);

    const submissions = await prisma.leaveApplication.findMany({
      where: {
        applicantId: actor.userId,
        status: { not: LeaveStatus.DRAFT },
      },
      include: {
        leaveType: true,
        approvalSteps: {
          orderBy: { sequence: "asc" },
          include: {
            assignedTo: {
              include: { role: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    const mapped = submissions.map((entry) => {
      const currentStep = entry.approvalSteps.find(
        (step) => step.status === "PENDING" || step.status === "IN_REVIEW",
      );
      const metadata = entry.metadata as Prisma.JsonObject | null;
      const formData =
        metadata && typeof metadata.formData === "object"
          ? (metadata.formData as Record<string, string>)
          : null;

      return {
        id: entry.id,
        referenceCode: entry.referenceCode,
        leaveType: entry.leaveType.name,
        leaveTypeCode: entry.leaveType.code,
        status: entry.status,
        startDate: entry.startDate.toISOString(),
        endDate: entry.endDate.toISOString(),
        totalDays: entry.totalDays,
        submittedAt:
          entry.submittedAt?.toISOString() ?? entry.createdAt.toISOString(),
        purpose: entry.purpose,
        destination: entry.destination,
        contactDuringLeave: entry.contactDuringLeave,
        notes: entry.notes,
        formData,
        currentApprover:
          currentStep?.assignedTo?.name ??
          currentStep?.assignedTo?.role?.name ??
          null,
        approvalTrail: entry.approvalSteps.map((step) => ({
          sequence: step.sequence,
          actor: step.actor,
          status: step.status,
          assignedTo:
            step.assignedTo?.name ?? step.assignedTo?.role?.name ?? null,
          actedAt: step.actedAt?.toISOString() ?? null,
          remarks: step.remarks ?? null,
        })),
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        items: mapped,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Unable to load leave submissions." },
      { status: 400 },
    );
  }
}
