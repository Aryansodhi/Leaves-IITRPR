import { RoleKey, Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const url = new URL(request.url);
    const referenceCode = url.searchParams.get("referenceCode")?.trim();

    if (!referenceCode) {
      return NextResponse.json(
        { ok: false, message: "Reference code is required." },
        { status: 400 },
      );
    }

    const application = await prisma.leaveApplication.findFirst({
      where: {
        referenceCode: { equals: referenceCode, mode: "insensitive" },
      },
      include: {
        leaveType: true,
        applicant: {
          include: { role: true, department: true },
        },
        approvalSteps: {
          include: {
            assignedTo: { select: { name: true, email: true } },
            actedBy: { select: { name: true, email: true } },
            escalatedTo: { select: { name: true, email: true } },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { ok: false, message: "Leave application not found." },
        { status: 404 },
      );
    }

    const auditLog = (
      prisma as unknown as {
        auditLog?: { findMany: (args: unknown) => Promise<unknown[]> };
      }
    ).auditLog;

    const auditLogs = auditLog
      ? await auditLog.findMany({
          where: {
            OR: [
              { referenceCode: application.referenceCode },
              { entityId: application.id },
            ],
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const metadata =
      application.metadata &&
      typeof application.metadata === "object" &&
      !Array.isArray(application.metadata)
        ? (application.metadata as Prisma.JsonObject)
        : null;

    const rawFormData =
      metadata && typeof metadata.formData === "object" && metadata.formData
        ? (metadata.formData as Record<string, unknown>)
        : null;
    const formData: Record<string, string> | null = rawFormData
      ? Object.fromEntries(
          Object.entries(rawFormData)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => [
              key,
              typeof value === "string" ? value : String(value),
            ]),
        )
      : null;

    const signatureProofRaw =
      metadata && typeof metadata.signatureProof === "object"
        ? (metadata.signatureProof as Prisma.JsonObject)
        : null;
    const signatureProof = signatureProofRaw
      ? {
          formId:
            typeof signatureProofRaw.formId === "string"
              ? signatureProofRaw.formId
              : undefined,
          animation: Array.isArray(signatureProofRaw.animation)
            ? (signatureProofRaw.animation as Array<{
                points: Array<{ x: number; y: number; time: number }>;
                color?: string;
              }>)
            : undefined,
          image:
            typeof signatureProofRaw.image === "string"
              ? signatureProofRaw.image
              : undefined,
          timestamp:
            typeof signatureProofRaw.timestamp === "string"
              ? signatureProofRaw.timestamp
              : undefined,
          hash:
            typeof signatureProofRaw.hash === "string"
              ? signatureProofRaw.hash
              : undefined,
          otpVerified:
            typeof signatureProofRaw.otpVerified === "boolean"
              ? signatureProofRaw.otpVerified
              : undefined,
        }
      : null;

    const currentStep = application.approvalSteps.find(
      (step) => step.status === "PENDING" || step.status === "IN_REVIEW",
    );
    const currentApprover = currentStep
      ? (currentStep.assignedTo?.name ?? currentStep.actor)
      : null;

    const approvalTrail = application.approvalSteps.map((entry) => {
      const meta = entry.metadata as Prisma.JsonObject | null;
      const approverSignatureProof =
        meta?.approverSignatureProof &&
        typeof meta.approverSignatureProof === "object"
          ? {
              image:
                typeof (meta.approverSignatureProof as Prisma.JsonObject)
                  ?.image === "string"
                  ? ((meta.approverSignatureProof as Prisma.JsonObject)
                      .image as string)
                  : null,
              animation: Array.isArray(
                (meta.approverSignatureProof as Prisma.JsonObject)?.animation,
              )
                ? ((meta.approverSignatureProof as Prisma.JsonObject)
                    .animation as unknown[])
                : null,
            }
          : null;

      return {
        sequence: entry.sequence,
        actor: entry.actor,
        status: entry.status,
        assignedTo: entry.assignedTo?.name ?? entry.actor,
        actedBy: entry.actedBy?.name ?? null,
        actedAt: entry.actedAt?.toISOString() ?? null,
        remarks: entry.remarks ?? null,
        recommended:
          typeof meta?.recommended === "string" ? meta.recommended : null,
        hodSignature:
          typeof meta?.hodSignature === "string" ? meta.hodSignature : null,
        accountsSignature:
          typeof meta?.accountsSignature === "string"
            ? meta.accountsSignature
            : null,
        balance: typeof meta?.balance === "string" ? meta.balance : null,
        decisionDate:
          typeof meta?.decisionDate === "string" ? meta.decisionDate : null,
        approverSignatureProof,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        application,
        request: {
          referenceCode: application.referenceCode,
          leaveType: application.leaveType.name,
          leaveTypeCode: application.leaveType.code,
          status: application.status,
          submittedAt:
            application.submittedAt?.toISOString() ??
            application.createdAt.toISOString(),
          startDate: application.startDate.toISOString(),
          endDate: application.endDate.toISOString(),
          totalDays: application.totalDays,
          purpose: application.purpose,
          destination: application.destination ?? null,
          contactDuringLeave: application.contactDuringLeave ?? null,
          notes: application.notes ?? null,
          currentApprover,
          applicant: {
            name: application.applicant.name,
            role:
              application.applicant.role?.name ??
              application.applicant.role?.key ??
              "Applicant",
            department: application.applicant.department?.name ?? "-",
            designation: application.applicant.designation ?? undefined,
          },
          formData,
          signatureProof,
          approvalTrail,
        },
        auditLogs,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Unable to load application trace." },
      { status: 400 },
    );
  }
}
