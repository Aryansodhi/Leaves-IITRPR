import { ApprovalStatus, LeaveStatus, type Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

const approvalActionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  remarks: z.string().trim().max(500).optional(),
});

const withStatus = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

type SessionActor = {
  userId: string;
};

const toBoolean = (value: Prisma.JsonValue | undefined, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const isJoiningReportType = (input: {
  code?: string | null;
  name?: string | null;
}) =>
  (input.code ?? "").toUpperCase() === "JR" ||
  (input.name ?? "").toLowerCase().includes("joining");

export const getLeaveApprovals = async (actor: SessionActor) => {
  const steps = await prisma.approvalStep.findMany({
    where: {
      assignedToId: actor.userId,
      leaveApplication: {
        status: { not: LeaveStatus.DRAFT },
      },
    },
    include: {
      assignedTo: {
        include: {
          role: true,
        },
      },
      leaveApplication: {
        include: {
          leaveType: true,
          applicant: {
            include: {
              role: true,
              department: true,
            },
          },
          approvalSteps: {
            orderBy: { sequence: "asc" },
            include: {
              assignedTo: {
                include: { role: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return {
    ok: true,
    data: steps.map((step) => {
      const metadata = step.leaveApplication
        .metadata as Prisma.JsonObject | null;
      const formData =
        metadata && typeof metadata.formData === "object"
          ? (metadata.formData as Record<string, string>)
          : null;
      const stepMetadata = step.metadata as Prisma.JsonObject | null;
      const isJoiningReport = isJoiningReportType({
        code: step.leaveApplication.leaveType.code,
        name: step.leaveApplication.leaveType.name,
      });
      const decisionRequired = isJoiningReport
        ? true
        : toBoolean(stepMetadata?.decisionRequired, true);
      const viewerOnly = isJoiningReport
        ? false
        : toBoolean(stepMetadata?.viewerOnly, false);

      return {
        applicationId: step.leaveApplicationId,
        referenceCode: step.leaveApplication.referenceCode,
        leaveType: step.leaveApplication.leaveType.name,
        leaveTypeCode: step.leaveApplication.leaveType.code,
        status: step.status,
        applicationStatus: step.leaveApplication.status,
        appliedAt:
          step.leaveApplication.submittedAt?.toISOString() ??
          step.leaveApplication.createdAt.toISOString(),
        submittedAt:
          step.leaveApplication.submittedAt?.toISOString() ??
          step.leaveApplication.createdAt.toISOString(),
        applicant: {
          id: step.leaveApplication.applicant.id,
          name: step.leaveApplication.applicant.name,
          role: step.leaveApplication.applicant.role?.name ?? "Unknown",
          department:
            step.leaveApplication.applicant.department?.name ??
            "Department not set",
          designation: step.leaveApplication.applicant.designation ?? "",
        },
        startDate: step.leaveApplication.startDate.toISOString(),
        endDate: step.leaveApplication.endDate.toISOString(),
        totalDays: step.leaveApplication.totalDays,
        purpose: step.leaveApplication.purpose,
        contactDuringLeave: step.leaveApplication.contactDuringLeave,
        destination: step.leaveApplication.destination,
        notes: step.leaveApplication.notes,
        currentApprover:
          step.assignedTo?.name ?? step.assignedTo?.role?.name ?? null,
        formData,
        remarks: step.remarks,
        actedAt: step.actedAt?.toISOString() ?? null,
        decisionRequired,
        viewerOnly,
        approvalTrail: step.leaveApplication.approvalSteps.map((entry) => ({
          sequence: entry.sequence,
          actor: entry.actor,
          status: entry.status,
          assignedTo:
            entry.assignedTo?.name ?? entry.assignedTo?.role?.name ?? null,
          actedAt: entry.actedAt?.toISOString() ?? null,
          remarks: entry.remarks ?? null,
        })),
      };
    }),
  };
};

export const decideLeaveApproval = async (
  applicationId: string,
  payload: unknown,
  actor: SessionActor,
) => {
  const parsed = approvalActionSchema.parse(payload);

  const step = await prisma.approvalStep.findFirst({
    where: {
      leaveApplicationId: applicationId,
      assignedToId: actor.userId,
      status: { in: [ApprovalStatus.PENDING, ApprovalStatus.IN_REVIEW] },
      leaveApplication: {
        status: { not: LeaveStatus.DRAFT },
      },
    },
    include: {
      leaveApplication: {
        include: {
          leaveType: true,
          approvalSteps: true,
        },
      },
    },
  });

  if (!step) {
    throw withStatus("No pending approval found for this request.", 404);
  }

  const stepMetadata = step.metadata as Prisma.JsonObject | null;
  const isJoiningReport = isJoiningReportType({
    code: step.leaveApplication.leaveType.code,
    name: step.leaveApplication.leaveType.name,
  });
  if (
    !isJoiningReport &&
    toBoolean(stepMetadata?.decisionRequired, true) === false
  ) {
    throw withStatus("This request is available for viewing only.", 403);
  }

  const hasPriorPendingStep = step.leaveApplication.approvalSteps.some(
    (candidate) =>
      candidate.sequence < step.sequence &&
      candidate.status !== ApprovalStatus.APPROVED &&
      candidate.status !== ApprovalStatus.SKIPPED,
  );

  if (hasPriorPendingStep) {
    throw withStatus("This request is awaiting an earlier approval step.", 409);
  }

  if (isJoiningReport && parsed.decision === "REJECT") {
    throw withStatus("Joining report can only be approved.", 403);
  }

  const now = new Date();
  const stepStatus =
    parsed.decision === "APPROVE"
      ? ApprovalStatus.APPROVED
      : ApprovalStatus.REJECTED;
  const remainingPendingSteps = step.leaveApplication.approvalSteps.some(
    (candidate) =>
      candidate.sequence > step.sequence &&
      (candidate.status === ApprovalStatus.PENDING ||
        candidate.status === ApprovalStatus.IN_REVIEW),
  );

  const applicationStatus =
    parsed.decision === "APPROVE"
      ? remainingPendingSteps
        ? LeaveStatus.UNDER_REVIEW
        : LeaveStatus.APPROVED
      : LeaveStatus.REJECTED;

  const transactionQueries: Prisma.PrismaPromise<unknown>[] = [
    prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: stepStatus,
        remarks: parsed.remarks ?? null,
        actedById: actor.userId,
        actedAt: now,
      },
    }),
  ];

  if (parsed.decision === "REJECT") {
    transactionQueries.push(
      prisma.approvalStep.updateMany({
        where: {
          leaveApplicationId: step.leaveApplicationId,
          sequence: { gt: step.sequence },
          status: { in: [ApprovalStatus.PENDING, ApprovalStatus.IN_REVIEW] },
        },
        data: {
          status: ApprovalStatus.SKIPPED,
          remarks: "Skipped due to rejection at an earlier workflow step.",
        },
      }),
    );
  }

  transactionQueries.push(
    prisma.leaveApplication.update({
      where: { id: step.leaveApplicationId },
      data: {
        status: applicationStatus,
        approvedAt:
          parsed.decision === "APPROVE" && !remainingPendingSteps ? now : null,
      },
    }),
  );

  await prisma.$transaction(transactionQueries);

  return {
    ok: true,
    message:
      parsed.decision === "APPROVE" ? "Request approved." : "Request rejected.",
  };
};
