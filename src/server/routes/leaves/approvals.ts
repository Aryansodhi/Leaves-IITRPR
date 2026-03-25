import { ApprovalStatus, LeaveStatus, Prisma, RoleKey } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import { sendLeaveStatusUpdateEmail } from "@/server/email/mailer";

const approvalActionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  remarks: z.string().trim().max(500).optional(),
  recommended: z.enum(["RECOMMENDED", "NOT_RECOMMENDED"]).optional(),
  hodSignature: z.string().trim().optional(),
  accountsSignature: z.string().trim().optional(),
  balance: z.string().trim().optional(), // for accounts to fill
  decisionDate: z.string().trim().optional(),
  approverSignatureProof: z
    .object({
      animation: z.array(z.unknown()).optional(),
      image: z.string().trim().optional(),
    })
    .optional(),
});

const withStatus = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

type SessionActor = {
  userId: string;
};

const bulkApprovalActionSchema = z.object({
  applicationIds: z.array(z.string().trim().min(1)).min(1).max(100),
  decision: z.enum(["APPROVE", "REJECT"]),
  remarks: z.string().trim().max(500).optional(),
  recommended: z.enum(["RECOMMENDED", "NOT_RECOMMENDED"]).optional(),
  hodSignature: z.string().trim().optional(),
  accountsSignature: z.string().trim().optional(),
  balance: z.string().trim().optional(),
  decisionDate: z.string().trim().optional(),
});

const toBoolean = (value: Prisma.JsonValue | undefined, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const isJoiningReportType = (input: {
  code?: string | null;
  name?: string | null;
}) =>
  (input.code ?? "").toUpperCase() === "JR" ||
  (input.name ?? "").toLowerCase().includes("joining");

const isMissingActingHodTableError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2021") {
    return false;
  }

  const table = typeof error.meta?.table === "string" ? error.meta.table : "";
  return table.toLowerCase().includes("actinghodassignment");
};

type ActingHodAssignmentDelegate = {
  findMany: (
    args: unknown,
  ) => Promise<Array<{ hodId: string; actingHodId?: string }>>;
  findFirst: (args: unknown) => Promise<{ id: string } | null>;
  create: (args: unknown) => Promise<unknown>;
};

const getActingHodAssignmentDelegate = () => {
  const candidate = (prisma as unknown as { actingHodAssignment?: unknown })
    .actingHodAssignment;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  if (
    !("findMany" in candidate) ||
    !("findFirst" in candidate) ||
    !("create" in candidate)
  ) {
    return null;
  }

  const delegate = candidate as ActingHodAssignmentDelegate;
  return typeof delegate.findMany === "function" &&
    typeof delegate.findFirst === "function" &&
    typeof delegate.create === "function"
    ? delegate
    : null;
};

const getProposedActingHodId = (
  metadata: Prisma.JsonValue | null | undefined,
) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const formData = (metadata as Prisma.JsonObject).formData;
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    return null;
  }

  const candidate = (formData as Record<string, unknown>).proposedActingHodId;
  if (typeof candidate !== "string") {
    return null;
  }

  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
};

type ActingHodRequestMeta = {
  candidateId: string;
  candidateName?: string;
  requestedById: string;
  requestedByName?: string;
  status: "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED";
  requestedAt: string;
  respondedAt?: string;
  responseById?: string;
};

const getActingHodRequestMeta = (
  metadata: Prisma.JsonValue | null | undefined,
): ActingHodRequestMeta | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const raw = (metadata as Prisma.JsonObject).actingHodRequest;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const typed = raw as Record<string, unknown>;
  if (
    typeof typed.candidateId !== "string" ||
    typeof typed.requestedById !== "string" ||
    typeof typed.status !== "string" ||
    typeof typed.requestedAt !== "string"
  ) {
    return null;
  }

  const status = typed.status;
  if (
    status !== "PENDING_CONFIRMATION" &&
    status !== "CONFIRMED" &&
    status !== "REJECTED"
  ) {
    return null;
  }

  return {
    candidateId: typed.candidateId,
    candidateName:
      typeof typed.candidateName === "string" ? typed.candidateName : undefined,
    requestedById: typed.requestedById,
    requestedByName:
      typeof typed.requestedByName === "string"
        ? typed.requestedByName
        : undefined,
    status,
    requestedAt: typed.requestedAt,
    respondedAt:
      typeof typed.respondedAt === "string" ? typed.respondedAt : undefined,
    responseById:
      typeof typed.responseById === "string" ? typed.responseById : undefined,
  };
};

const getDayWindow = (input: Date) => {
  const start = new Date(input);
  start.setHours(0, 0, 0, 0);

  const end = new Date(input);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const ensureActingHodAssignmentForFinalDeanApproval = async (input: {
  approvedById: string;
  application: {
    id: string;
    startDate: Date;
    endDate: Date;
    metadata: Prisma.JsonValue | null;
    applicant: {
      id: string;
      departmentId: string | null;
      role: { key: RoleKey } | null;
    };
  };
}) => {
  const actingHodAssignment = getActingHodAssignmentDelegate();
  if (!actingHodAssignment) {
    throw withStatus(
      "Acting HoD feature is temporarily unavailable. Please run Prisma generate/migrations.",
      503,
    );
  }

  if (input.application.applicant.role?.key !== RoleKey.HOD) {
    return;
  }

  const existingAssignment = await actingHodAssignment.findFirst({
    where: {
      hodId: input.application.applicant.id,
      startDate: { lte: input.application.endDate },
      endDate: { gte: input.application.startDate },
    },
    select: { id: true },
  });

  if (existingAssignment) {
    return;
  }

  const actingRequest = getActingHodRequestMeta(input.application.metadata);
  if (!actingRequest) {
    const proposedActingHodId = getProposedActingHodId(
      input.application.metadata,
    );
    if (proposedActingHodId) {
      throw withStatus(
        "Proposed acting HoD exists but is not confirmed. Dean must request confirmation before final approval.",
        409,
      );
    }

    throw withStatus(
      "Please request and confirm an acting HoD before final approval.",
      409,
    );
  }

  if (actingRequest.status !== "CONFIRMED") {
    if (actingRequest.status === "PENDING_CONFIRMATION") {
      throw withStatus(
        "Acting HoD confirmation is still pending. Final approval is blocked until candidate accepts.",
        409,
      );
    }

    throw withStatus(
      "Acting HoD request was rejected. Dean must select another candidate before final approval.",
      409,
    );
  }

  const confirmedAssignment = await actingHodAssignment.findFirst({
    where: {
      hodId: input.application.applicant.id,
      actingHodId: actingRequest.candidateId,
      startDate: { lte: input.application.endDate },
      endDate: { gte: input.application.startDate },
    },
    select: { id: true },
  });

  if (!confirmedAssignment) {
    throw withStatus(
      "Confirmed acting HoD assignment record not found. Please re-request acting HoD confirmation.",
      409,
    );
  }
};

const resolveActingHodCoverage = async (actorId: string, at: Date) => {
  const actingHodAssignment = getActingHodAssignmentDelegate();
  if (!actingHodAssignment) {
    return { hodIds: [] };
  }

  const dayWindow = getDayWindow(at);

  let assignments: Array<{ hodId: string }> = [];

  try {
    assignments = await actingHodAssignment.findMany({
      where: {
        actingHodId: actorId,
        startDate: { lte: dayWindow.end },
        endDate: { gte: dayWindow.start },
      },
      select: { hodId: true },
    });
  } catch (error) {
    if (isMissingActingHodTableError(error)) {
      return { hodIds: [] };
    }
    throw error;
  }

  if (assignments.length === 0) {
    return { hodIds: [] };
  }

  const hodIds = Array.from(new Set(assignments.map((item) => item.hodId)));
  const activeLeaves = await prisma.leaveApplication.findMany({
    where: {
      applicantId: { in: hodIds },
      status: { in: [LeaveStatus.APPROVED, LeaveStatus.UNDER_REVIEW] },
      startDate: { lte: dayWindow.end },
      endDate: { gte: dayWindow.start },
    },
    select: { applicantId: true },
  });

  const activeHodIds = new Set(activeLeaves.map((leave) => leave.applicantId));
  return {
    hodIds: hodIds.filter((hodId) => activeHodIds.has(hodId)),
  };
};

export const getLeaveApprovals = async (actor: SessionActor) => {
  const actorProfile = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true },
  });

  if (!actorProfile) {
    throw withStatus("Unable to resolve approver profile.", 403);
  }

  const now = new Date();
  const dayWindow = getDayWindow(now);
  const actingHodAssignment = getActingHodAssignmentDelegate();
  const actorSelfDelegation =
    actorProfile.role?.key === RoleKey.HOD && actingHodAssignment
      ? await actingHodAssignment.findFirst({
          where: {
            hodId: actor.userId,
            startDate: { lte: dayWindow.end },
            endDate: { gte: dayWindow.start },
          },
          select: { id: true },
        })
      : null;
  const actingCoverage = await resolveActingHodCoverage(actor.userId, now);
  const actorDelegationAssignments =
    actorProfile.role?.key === RoleKey.HOD && actingHodAssignment
      ? await actingHodAssignment.findMany({
          where: {
            hodId: actor.userId,
            startDate: { lte: dayWindow.end },
            endDate: { gte: dayWindow.start },
          },
          select: { actingHodId: true },
        })
      : [];
  const delegatedActingIds = new Set(
    actorDelegationAssignments
      .map((item) => item.actingHodId)
      .filter((value): value is string => typeof value === "string"),
  );
  const assignedIds = Array.from(
    new Set([actor.userId, ...actingCoverage.hodIds, ...delegatedActingIds]),
  );

  const steps = await prisma.approvalStep.findMany({
    where: {
      assignedToId: { in: assignedIds },
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
      const storedDays = formData?.days;
      const parsedDays = storedDays ? Number.parseFloat(storedDays) : null;
      const signatureProof =
        metadata && typeof metadata.signatureProof === "object"
          ? (metadata.signatureProof as Record<string, unknown>)
          : null;
      const actingHodRequest = getActingHodRequestMeta(metadata);
      const stepMetadata = step.metadata as Prisma.JsonObject | null;
      const isJoiningReport = isJoiningReportType({
        code: step.leaveApplication.leaveType.code,
        name: step.leaveApplication.leaveType.name,
      });
      const baseDecisionRequired = isJoiningReport
        ? true
        : toBoolean(stepMetadata?.decisionRequired, true);
      const baseViewerOnly = isJoiningReport
        ? false
        : toBoolean(stepMetadata?.viewerOnly, false);
      const isHodStep = step.actor === "HOD";
      const isOriginalHodViewingOwnStep =
        isHodStep && step.assignedToId === actor.userId;
      const isOriginalHodViewingActingStep =
        isHodStep &&
        actorProfile.role?.key === RoleKey.HOD &&
        step.assignedToId !== actor.userId &&
        delegatedActingIds.has(step.assignedToId);
      const isHodTemporarilyViewOnly =
        Boolean(actorSelfDelegation) &&
        (isOriginalHodViewingOwnStep || isOriginalHodViewingActingStep);
      const decisionRequired =
        baseDecisionRequired && !isHodTemporarilyViewOnly;
      const viewerOnly = baseViewerOnly || isHodTemporarilyViewOnly;
      const delegatedFromHodName =
        isHodStep && step.assignedToId !== actor.userId
          ? (step.assignedTo?.name ?? null)
          : null;

      return {
        approvalStepId: step.id,
        applicationId: step.leaveApplicationId,
        currentApprovalActor: step.actor,
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
          roleKey: step.leaveApplication.applicant.role?.key ?? null,
          department:
            step.leaveApplication.applicant.department?.name ??
            "Department not set",
          designation: step.leaveApplication.applicant.designation ?? "",
        },
        startDate: step.leaveApplication.startDate.toISOString(),
        endDate: step.leaveApplication.endDate.toISOString(),
        totalDays:
          parsedDays && Number.isFinite(parsedDays)
            ? parsedDays
            : step.leaveApplication.totalDays,
        purpose: step.leaveApplication.purpose,
        contactDuringLeave: step.leaveApplication.contactDuringLeave,
        destination: step.leaveApplication.destination,
        notes: step.leaveApplication.notes,
        currentApprover:
          step.assignedTo?.name ?? step.assignedTo?.role?.name ?? null,
        delegatedFromHodName,
        formData,
        signatureProof,
        actingHodRequest,
        remarks: step.remarks,
        actedAt: step.actedAt?.toISOString() ?? null,
        decisionRequired,
        viewerOnly,
        approvalTrail: step.leaveApplication.approvalSteps.map((entry) => {
          const meta = entry.metadata as Prisma.JsonObject | null;
          return {
            sequence: entry.sequence,
            actor: entry.actor,
            status: entry.status,
            assignedTo:
              entry.assignedTo?.name ?? entry.assignedTo?.role?.name ?? null,
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
          };
        }),
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

  const actorProfile = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true },
  });

  if (!actorProfile) {
    throw withStatus("Unable to resolve approver profile.", 403);
  }

  const now = new Date();
  const dayWindow = getDayWindow(now);
  const actingCoverage = await resolveActingHodCoverage(actor.userId, now);
  const assignedIds = Array.from(
    new Set([actor.userId, ...actingCoverage.hodIds]),
  );

  // Relaxed query: If there is a pending step assigned to this user, grab it.
  const step = await prisma.approvalStep.findFirst({
    where: {
      leaveApplicationId: applicationId,
      assignedToId: { in: assignedIds },
      status: { in: [ApprovalStatus.PENDING, ApprovalStatus.IN_REVIEW] },
    },
    include: {
      leaveApplication: {
        include: {
          leaveType: true,
          applicant: {
            include: {
              role: true,
            },
          },
          approvalSteps: true,
        },
      },
    },
  });

  if (!step) {
    throw withStatus(
      "No pending approval found for this request. It may have already been approved.",
      404,
    );
  }

  const actingHodAssignment = getActingHodAssignmentDelegate();
  if (
    step.actor === "HOD" &&
    step.assignedToId === actor.userId &&
    actorProfile.role?.key === RoleKey.HOD &&
    actingHodAssignment
  ) {
    const activeDelegation = await actingHodAssignment.findFirst({
      where: {
        hodId: actor.userId,
        startDate: { lte: dayWindow.end },
        endDate: { gte: dayWindow.start },
      },
      select: { id: true },
    });

    if (activeDelegation) {
      throw withStatus(
        "You are currently on delegated leave period. HoD approvals are view-only until delegation ends.",
        403,
      );
    }
  }

  const stepMetadata = step.metadata as Prisma.JsonObject | null;
  const isJoiningReport = isJoiningReportType({
    code: step.leaveApplication.leaveType.code,
    name: step.leaveApplication.leaveType.name,
  });
  const isAccountsStep = step.actor === "ACCOUNTS";
  if (
    !isJoiningReport &&
    toBoolean(stepMetadata?.decisionRequired, true) === false
  ) {
    throw withStatus("This request is available for viewing only.", 403);
  }

  if (isAccountsStep && parsed.decision === "REJECT") {
    throw withStatus(
      "Accounts section cannot reject the request. Please fill the balance and continue.",
      403,
    );
  }

  if (isAccountsStep && !(parsed.balance && parsed.balance.trim())) {
    throw withStatus("Please provide balance as on date.", 400);
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

  const isFinalDeanApprovalForHodLeave =
    parsed.decision === "APPROVE" &&
    !remainingPendingSteps &&
    actorProfile.role?.key === RoleKey.DEAN &&
    step.leaveApplication.applicant.role?.key === RoleKey.HOD;

  if (isFinalDeanApprovalForHodLeave) {
    await ensureActingHodAssignmentForFinalDeanApproval({
      approvedById: actor.userId,
      application: {
        id: step.leaveApplication.id,
        startDate: step.leaveApplication.startDate,
        endDate: step.leaveApplication.endDate,
        metadata: step.leaveApplication.metadata,
        applicant: {
          id: step.leaveApplication.applicant.id,
          departmentId: step.leaveApplication.applicant.departmentId,
          role: step.leaveApplication.applicant.role,
        },
      },
    });
  }

  const transactionQueries: Prisma.PrismaPromise<unknown>[] = [
    prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: stepStatus,
        remarks: parsed.remarks ?? null,
        actedById: actor.userId,
        actedAt: now,
        metadata: {
          ...(step.metadata as Prisma.JsonObject),
          ...(parsed.recommended && { recommended: parsed.recommended }),
          ...(parsed.hodSignature && { hodSignature: parsed.hodSignature }),
          ...(parsed.accountsSignature && {
            accountsSignature: parsed.accountsSignature,
          }),
          ...(parsed.balance && { balance: parsed.balance }),
          ...(parsed.decisionDate && { decisionDate: parsed.decisionDate }),
          ...(parsed.approverSignatureProof && {
            approverSignatureProof: parsed.approverSignatureProof,
          }),
        } as Prisma.InputJsonValue,
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

  try {
    const actorUser = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { name: true },
    });

    await sendLeaveStatusUpdateEmail({
      to: step.leaveApplication.applicant.email,
      applicantName: step.leaveApplication.applicant.name,
      referenceCode: step.leaveApplication.referenceCode,
      leaveType: step.leaveApplication.leaveType.name,
      status: applicationStatus,
      startDate: step.leaveApplication.startDate,
      endDate: step.leaveApplication.endDate,
      totalDays: step.leaveApplication.totalDays,
      actionLabel:
        parsed.decision === "APPROVE"
          ? "Your leave request status has been updated to Approved."
          : "Your leave request status has been updated to Rejected.",
      actionBy: actorUser?.name ?? null,
      remarks: parsed.remarks ?? null,
    });
  } catch (error) {
    console.error("Failed to send leave status update email", error);
  }

  return {
    ok: true,
    message:
      parsed.decision === "APPROVE" ? "Request approved." : "Request rejected.",
  };
};

export const bulkDecideLeaveApprovals = async (
  payload: unknown,
  actor: SessionActor,
) => {
  const parsed = bulkApprovalActionSchema.parse(payload);
  const uniqueIds = Array.from(new Set(parsed.applicationIds));

  const successes: string[] = [];
  const failures: Array<{ applicationId: string; message: string }> = [];

  for (const applicationId of uniqueIds) {
    try {
      await decideLeaveApproval(
        applicationId,
        {
          decision: parsed.decision,
          remarks: parsed.remarks,
          recommended: parsed.recommended,
          hodSignature: parsed.hodSignature,
          accountsSignature: parsed.accountsSignature,
          balance: parsed.balance,
          decisionDate: parsed.decisionDate,
        },
        actor,
      );
      successes.push(applicationId);
    } catch (error) {
      failures.push({
        applicationId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const status = failures.length ? 207 : 200;
  const summary = `${successes.length} request(s) ${parsed.decision === "APPROVE" ? "approved" : "rejected"}`;

  return {
    ok: failures.length === 0,
    status,
    message: failures.length
      ? `${summary}; ${failures.length} failed.`
      : `${summary} successfully.`,
    data: {
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures,
    },
  };
};
