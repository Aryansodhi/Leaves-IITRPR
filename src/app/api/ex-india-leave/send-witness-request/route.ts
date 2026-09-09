import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { sendLeaveSubmissionEmail } from "@/server/email/mailer";

type WitnessRequest = {
  sequence?: number;
  witnessId?: string;
  requestedAt?: string;
  reminderAt?: string;
};

const asJsonObject = (value: Prisma.JsonValue | null) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : {};

const isWitnessStep = (metadata: Prisma.JsonValue | null) =>
  asJsonObject(metadata).role === "witness";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const {
    applicationId,
    remindMinutes = 60,
    witnessId,
    sequence,
  } = body as {
    applicationId?: string;
    remindMinutes?: number;
    witnessId?: string;
    sequence?: number;
  };
  if (!applicationId)
    return NextResponse.json(
      { ok: false, error: "Missing applicationId" },
      { status: 400 },
    );

  const application = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      approvalSteps: {
        include: { assignedTo: true },
        orderBy: { sequence: "asc" },
      },
      applicant: true,
    },
  });
  if (!application)
    return NextResponse.json(
      { ok: false, error: "Application not found" },
      { status: 404 },
    );

  const now = new Date();
  const reminderAt = new Date(
    now.getTime() + (remindMinutes || 60) * 1000 * 60,
  );

  try {
    if (witnessId && sequence) {
      const step = application.approvalSteps.find(
        (s) => s.sequence === sequence && isWitnessStep(s.metadata),
      );
      if (!step) {
        return NextResponse.json(
          { ok: false, error: "Witness step not found." },
          { status: 404 },
        );
      }

      const witness = await prisma.user.findFirst({
        where: { id: witnessId, isActive: true },
      });
      if (!witness) {
        return NextResponse.json(
          { ok: false, error: "Witness not found." },
          { status: 404 },
        );
      }

      const assignedChanged = step.assignedToId !== witnessId;
      await prisma.approvalStep.update({
        where: { id: step.id },
        data: {
          assignedTo: { connect: { id: witnessId } },
          status: assignedChanged ? "PENDING" : step.status,
          metadata: {
            ...asJsonObject(step.metadata),
            requestedAt: now.toISOString(),
            reminderAt: reminderAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      const metadata = asJsonObject(application.metadata);
      const prevWitnessId = step.assignedToId;
      const existingRequests = Array.isArray(metadata.witnessRequests)
        ? (metadata.witnessRequests as WitnessRequest[])
        : [];
      const nextRequests = existingRequests
        .filter(
          (req) =>
            req?.sequence !== sequence && req?.witnessId !== prevWitnessId,
        )
        .concat([
          {
            sequence,
            witnessId,
            requestedAt: now.toISOString(),
            reminderAt: reminderAt.toISOString(),
          },
        ]);

      const witnessIds = application.approvalSteps
        .filter((s) => isWitnessStep(s.metadata))
        .map((s) => (s.sequence === sequence ? witnessId : s.assignedToId));

      await prisma.leaveApplication.update({
        where: { id: applicationId },
        data: {
          metadata: {
            ...metadata,
            witnesses: witnessIds.filter(Boolean),
            witnessRequests: nextRequests,
          } as Prisma.InputJsonValue,
        },
      });

      await sendLeaveSubmissionEmail({
        to: witness.email,
        applicantName: application.applicant?.name ?? "",
        referenceCode: application.referenceCode,
        leaveType: "Ex-India",
        status: application.status,
        startDate: application.startDate,
        endDate: application.endDate,
        totalDays: application.totalDays,
        actionLabel:
          "You have been requested to endorse as a witness for an Ex-India leave application.",
        actionBy: application.applicant?.name ?? "",
      });

      return NextResponse.json({ ok: true });
    }

    for (const step of application.approvalSteps.filter((item) =>
      isWitnessStep(item.metadata),
    )) {
      const u = step.assignedTo;
      if (!u) continue;
      await sendLeaveSubmissionEmail({
        to: u.email,
        applicantName: application.applicant?.name ?? "",
        referenceCode: application.referenceCode,
        leaveType: "Ex-India",
        status: application.status,
        startDate: application.startDate,
        endDate: application.endDate,
        totalDays: application.totalDays,
        actionLabel:
          "You have been requested to endorse as a witness for an Ex-India leave application.",
        actionBy: application.applicant?.name ?? "",
      });

      await prisma.approvalStep.update({
        where: { id: step.id },
        data: {
          metadata: {
            ...asJsonObject(step.metadata),
            requestedAt: now.toISOString(),
            reminderAt: reminderAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    await prisma.leaveApplication.update({
      where: { id: applicationId },
      data: {
        metadata: {
          ...asJsonObject(application.metadata),
          lastWitnessRequestAt: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send witness requests", err);
    return NextResponse.json(
      { ok: false, error: "Failed to send" },
      { status: 500 },
    );
  }
}
