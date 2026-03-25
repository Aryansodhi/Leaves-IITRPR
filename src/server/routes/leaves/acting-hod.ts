import { ApprovalStatus, LeaveStatus, Prisma, RoleKey } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

const assignmentSchema = z.object({
  actingHodId: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
});

const deanAssignmentSchema = assignmentSchema.extend({
  hodId: z.string().trim().min(1),
});

const withStatus = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

type ActingHodAssignmentDelegate = {
  findFirst: (args: unknown) => Promise<{
    id: string;
    actingHodId: string;
    startDate: Date;
    endDate: Date;
    actingHod: { name: string };
    assignedBy: { name: string };
  } | null>;
  findMany: (args: unknown) => Promise<
    Array<{
      id: string;
      hodId: string;
      actingHodId: string;
      startDate: Date;
      endDate: Date;
      hod: { name: string };
      assignedBy: { name: string };
    }>
  >;
  create: (args: unknown) => Promise<{
    id: string;
    actingHodId: string;
    startDate: Date;
    endDate: Date;
    actingHod: { name: string };
    assignedBy: { name: string };
  }>;
};

const getActingHodAssignmentDelegate = () => {
  const candidate = (prisma as unknown as { actingHodAssignment?: unknown })
    .actingHodAssignment;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  if (
    !("findFirst" in candidate) ||
    !("findMany" in candidate) ||
    !("create" in candidate)
  ) {
    return null;
  }

  const delegate = candidate as ActingHodAssignmentDelegate;
  if (
    typeof delegate.findFirst !== "function" ||
    typeof delegate.findMany !== "function" ||
    typeof delegate.create !== "function"
  ) {
    return null;
  }

  return delegate;
};

const parseDateInput = (raw: string) => {
  const normalized = raw.trim();
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;

  const fallback = new Date(year, month - 1, day);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const getDayWindow = (input: Date) => {
  const start = new Date(input);
  start.setHours(0, 0, 0, 0);

  const end = new Date(input);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const findEligibleLeaveWindow = async (input: {
  hodId: string;
  startDate: Date;
  endDate: Date;
}) => {
  const record = await prisma.leaveApplication.findFirst({
    where: {
      applicantId: input.hodId,
      status: { in: [LeaveStatus.APPROVED, LeaveStatus.UNDER_REVIEW] },
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
    },
    orderBy: { startDate: "desc" },
  });

  if (!record) return null;

  return {
    startDate: record.startDate,
    endDate: record.endDate,
  };
};

const listCandidates = async (hodId: string, departmentId: string | null) => {
  if (!departmentId) return [];

  const candidates = await prisma.user.findMany({
    where: {
      isActive: true,
      departmentId,
      id: { not: hodId },
      role: { key: { in: [RoleKey.ASSOCIATE_HOD, RoleKey.FACULTY] } },
    },
    include: { role: true },
    orderBy: { name: "asc" },
  });

  return candidates.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.role?.name ?? user.role?.key ?? "Member",
  }));
};

const listDeanCandidates = async (hodId: string) => {
  const candidates = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: hodId },
    },
    include: {
      role: true,
      department: true,
    },
    orderBy: { name: "asc" },
  });

  return candidates.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.role?.name ?? user.role?.key ?? "Member",
    department: user.department?.name ?? "Department not set",
  }));
};

type SessionActor = {
  userId: string;
};

type ActingHodRequestStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED";

type ActingHodRequestMeta = {
  candidateId: string;
  candidateName: string;
  requestedById: string;
  requestedByName?: string;
  status: ActingHodRequestStatus;
  requestedAt: string;
  respondedAt?: string;
  responseById?: string;
};

const leaveRequestSchema = z.object({
  applicationId: z.string().trim().min(1),
  actingHodId: z.string().trim().min(1),
});

const leaveResponseSchema = z.object({
  applicationId: z.string().trim().min(1),
  decision: z.enum(["ACCEPT", "REJECT"]),
});

const extractActingHodRequestMeta = (
  metadata: Prisma.JsonValue | null | undefined,
): ActingHodRequestMeta | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const request = (metadata as Prisma.JsonObject).actingHodRequest;
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return null;
  }

  const typed = request as Record<string, unknown>;
  if (
    typeof typed.candidateId !== "string" ||
    typeof typed.requestedById !== "string" ||
    typeof typed.status !== "string" ||
    typeof typed.requestedAt !== "string"
  ) {
    return null;
  }

  return {
    candidateId: typed.candidateId,
    candidateName:
      typeof typed.candidateName === "string" ? typed.candidateName : "",
    requestedById: typed.requestedById,
    requestedByName:
      typeof typed.requestedByName === "string"
        ? typed.requestedByName
        : undefined,
    status: typed.status as ActingHodRequestStatus,
    requestedAt: typed.requestedAt,
    respondedAt:
      typeof typed.respondedAt === "string" ? typed.respondedAt : undefined,
    responseById:
      typeof typed.responseById === "string" ? typed.responseById : undefined,
  };
};

const isEligibleActingCandidate = (input: {
  candidate: {
    id: string;
    isActive: boolean;
    departmentId: string | null;
    role: { key: RoleKey } | null;
  };
  hod: { id: string; departmentId: string | null };
}) => {
  if (!input.candidate.isActive) return false;
  if (!input.hod.departmentId) return false;
  if (input.candidate.id === input.hod.id) return false;
  if (input.candidate.departmentId !== input.hod.departmentId) return false;

  return (
    input.candidate.role?.key === RoleKey.ASSOCIATE_HOD ||
    input.candidate.role?.key === RoleKey.FACULTY
  );
};

export const getActingHodStatus = async (actor: SessionActor) => {
  const hod = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true, department: true },
  });

  if (!hod || hod.role?.key !== RoleKey.HOD) {
    throw withStatus("Acting HoD assignment is limited to HoD accounts.", 403);
  }

  const now = new Date();
  const dayWindow = getDayWindow(now);
  const actingHodAssignment = getActingHodAssignmentDelegate();
  const activeLeave = await findEligibleLeaveWindow({
    hodId: hod.id,
    startDate: dayWindow.start,
    endDate: dayWindow.end,
  });

  const activeAssignment = actingHodAssignment
    ? await actingHodAssignment.findFirst({
        where: {
          hodId: hod.id,
          startDate: { lte: dayWindow.end },
          endDate: { gte: dayWindow.start },
        },
        include: {
          actingHod: true,
          assignedBy: true,
        },
        orderBy: { startDate: "desc" },
      })
    : null;

  const candidates = await listCandidates(hod.id, hod.departmentId ?? null);

  return {
    ok: true,
    data: {
      hod: {
        id: hod.id,
        name: hod.name,
        department: hod.department?.name ?? null,
      },
      isOnLeave: Boolean(activeLeave),
      leaveWindow: activeLeave
        ? {
            startDate: activeLeave.startDate.toISOString(),
            endDate: activeLeave.endDate.toISOString(),
          }
        : null,
      activeAssignment: activeAssignment
        ? {
            id: activeAssignment.id,
            actingHodId: activeAssignment.actingHodId,
            actingHodName: activeAssignment.actingHod.name,
            startDate: activeAssignment.startDate.toISOString(),
            endDate: activeAssignment.endDate.toISOString(),
            assignedByName: activeAssignment.assignedBy.name,
          }
        : null,
      candidates,
    },
  };
};

export const createActingHodAssignment = async (
  payload: unknown,
  actor: SessionActor,
) => {
  const actingHodAssignment = getActingHodAssignmentDelegate();
  if (!actingHodAssignment) {
    throw withStatus(
      "Acting HoD feature is temporarily unavailable. Please run Prisma generate/migrations.",
      503,
    );
  }

  const parsed = assignmentSchema.parse(payload);

  const hod = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true, department: true },
  });

  if (!hod || hod.role?.key !== RoleKey.HOD) {
    throw withStatus("Only a HoD can assign an acting HoD.", 403);
  }

  const startDate = parseDateInput(parsed.startDate);
  const endDate = parseDateInput(parsed.endDate);

  if (!startDate || !endDate || endDate < startDate) {
    throw withStatus("Please provide a valid acting period.", 400);
  }

  const activeLeave = await findEligibleLeaveWindow({
    hodId: hod.id,
    startDate,
    endDate,
  });

  if (!activeLeave) {
    throw withStatus(
      "No approved or under-review leave found for the selected period.",
      400,
    );
  }

  const actingCandidate = await prisma.user.findUnique({
    where: { id: parsed.actingHodId },
    include: { role: true },
  });

  if (!actingCandidate || !actingCandidate.isActive) {
    throw withStatus("Acting HoD selection is invalid.", 400);
  }

  if (actingCandidate.departmentId !== hod.departmentId) {
    throw withStatus("Acting HoD must belong to the same department.", 400);
  }

  if (
    actingCandidate.role?.key !== RoleKey.ASSOCIATE_HOD &&
    actingCandidate.role?.key !== RoleKey.FACULTY
  ) {
    throw withStatus("Selected user cannot be assigned as acting HoD.", 400);
  }

  const existing = await actingHodAssignment.findFirst({
    where: {
      hodId: hod.id,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  if (existing) {
    throw withStatus(
      "An acting HoD is already assigned for the selected period.",
      409,
    );
  }

  const assignment = await actingHodAssignment.create({
    data: {
      hodId: hod.id,
      actingHodId: actingCandidate.id,
      assignedById: hod.id,
      startDate,
      endDate,
    },
    include: {
      actingHod: true,
      assignedBy: true,
    },
  });

  return {
    ok: true,
    message: "Acting HoD assigned successfully.",
    data: {
      id: assignment.id,
      actingHodId: assignment.actingHodId,
      actingHodName: assignment.actingHod.name,
      startDate: assignment.startDate.toISOString(),
      endDate: assignment.endDate.toISOString(),
      assignedByName: assignment.assignedBy.name,
    },
  };
};

export const getActingHodStatusForDean = async (actor: SessionActor) => {
  const dean = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true },
  });

  if (!dean || dean.role?.key !== RoleKey.DEAN) {
    throw withStatus("Only Dean accounts can manage acting HoD.", 403);
  }

  const now = new Date();
  const dayWindow = getDayWindow(now);
  const actingHodAssignment = getActingHodAssignmentDelegate();
  const hodsOnLeave = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { key: RoleKey.HOD },
      leaveApplications: {
        some: {
          status: { in: [LeaveStatus.APPROVED, LeaveStatus.UNDER_REVIEW] },
          startDate: { lte: dayWindow.end },
          endDate: { gte: dayWindow.start },
        },
      },
    },
    include: { department: true },
    orderBy: { name: "asc" },
  });

  const items = await Promise.all(
    hodsOnLeave.map(async (hod) => {
      const activeLeave = await findEligibleLeaveWindow({
        hodId: hod.id,
        startDate: dayWindow.start,
        endDate: dayWindow.end,
      });
      const activeAssignment = actingHodAssignment
        ? await actingHodAssignment.findFirst({
            where: {
              hodId: hod.id,
              startDate: { lte: dayWindow.end },
              endDate: { gte: dayWindow.start },
            },
            include: { actingHod: true, assignedBy: true },
            orderBy: { startDate: "desc" },
          })
        : null;

      const candidates = await listDeanCandidates(hod.id);

      return {
        hod: {
          id: hod.id,
          name: hod.name,
          department: hod.department?.name ?? null,
        },
        leaveWindow: activeLeave
          ? {
              startDate: activeLeave.startDate.toISOString(),
              endDate: activeLeave.endDate.toISOString(),
            }
          : null,
        activeAssignment: activeAssignment
          ? {
              id: activeAssignment.id,
              actingHodId: activeAssignment.actingHodId,
              actingHodName: activeAssignment.actingHod.name,
              startDate: activeAssignment.startDate.toISOString(),
              endDate: activeAssignment.endDate.toISOString(),
              assignedByName: activeAssignment.assignedBy.name,
            }
          : null,
        candidates,
      };
    }),
  );

  return {
    ok: true,
    data: {
      hods: items,
    },
  };
};

export const createActingHodAssignmentByDean = async (
  payload: unknown,
  actor: SessionActor,
) => {
  const actingHodAssignment = getActingHodAssignmentDelegate();
  if (!actingHodAssignment) {
    throw withStatus(
      "Acting HoD feature is temporarily unavailable. Please run Prisma generate/migrations.",
      503,
    );
  }

  const parsed = deanAssignmentSchema.parse(payload);

  const dean = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true },
  });

  if (!dean || dean.role?.key !== RoleKey.DEAN) {
    throw withStatus("Only Dean accounts can manage acting HoD.", 403);
  }

  const hod = await prisma.user.findUnique({
    where: { id: parsed.hodId },
    include: { role: true },
  });

  if (!hod || hod.role?.key !== RoleKey.HOD) {
    throw withStatus("Selected HoD is invalid.", 400);
  }

  const startDate = parseDateInput(parsed.startDate);
  const endDate = parseDateInput(parsed.endDate);

  if (!startDate || !endDate || endDate < startDate) {
    throw withStatus("Please provide a valid acting period.", 400);
  }

  const activeLeave = await findEligibleLeaveWindow({
    hodId: hod.id,
    startDate,
    endDate,
  });

  if (!activeLeave) {
    throw withStatus(
      "No approved or under-review leave found for the selected HoD period.",
      400,
    );
  }

  const actingCandidate = await prisma.user.findUnique({
    where: { id: parsed.actingHodId },
    include: { role: true },
  });

  if (!actingCandidate || !actingCandidate.isActive) {
    throw withStatus("Acting HoD selection is invalid.", 400);
  }

  if (actingCandidate.id === hod.id) {
    throw withStatus("HoD cannot be assigned as acting HoD for self.", 400);
  }

  const existing = await actingHodAssignment.findFirst({
    where: {
      hodId: hod.id,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  if (existing) {
    throw withStatus(
      "An acting HoD is already assigned for the selected period.",
      409,
    );
  }

  const assignment = await actingHodAssignment.create({
    data: {
      hodId: hod.id,
      actingHodId: actingCandidate.id,
      assignedById: dean.id,
      startDate,
      endDate,
    },
    include: { actingHod: true, assignedBy: true },
  });

  return {
    ok: true,
    message: "Acting HoD assigned successfully.",
    data: {
      id: assignment.id,
      actingHodId: assignment.actingHodId,
      actingHodName: assignment.actingHod.name,
      startDate: assignment.startDate.toISOString(),
      endDate: assignment.endDate.toISOString(),
      assignedByName: assignment.assignedBy.name,
    },
  };
};

export const requestActingHodForLeave = async (
  payload: unknown,
  actor: SessionActor,
) => {
  const actingHodAssignment = getActingHodAssignmentDelegate();
  if (!actingHodAssignment) {
    throw withStatus(
      "Acting HoD feature is temporarily unavailable. Please run Prisma generate/migrations.",
      503,
    );
  }

  const parsed = leaveRequestSchema.parse(payload);
  const dean = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true },
  });

  if (!dean || dean.role?.key !== RoleKey.DEAN) {
    throw withStatus("Only Dean can request acting HoD confirmation.", 403);
  }

  const step = await prisma.approvalStep.findFirst({
    where: {
      leaveApplicationId: parsed.applicationId,
      assignedToId: dean.id,
      actor: "DEAN",
      status: { in: [ApprovalStatus.PENDING, ApprovalStatus.IN_REVIEW] },
    },
    include: {
      leaveApplication: {
        include: {
          applicant: { include: { role: true, department: true } },
          approvalSteps: true,
        },
      },
    },
  });

  if (!step) {
    throw withStatus("No pending Dean approval found for this leave.", 404);
  }

  const hasLaterPending = step.leaveApplication.approvalSteps.some(
    (candidate) =>
      candidate.sequence > step.sequence &&
      (candidate.status === ApprovalStatus.PENDING ||
        candidate.status === ApprovalStatus.IN_REVIEW),
  );

  if (hasLaterPending) {
    throw withStatus("This leave is not at final Dean approval stage.", 409);
  }

  if (step.leaveApplication.applicant.role?.key !== RoleKey.HOD) {
    throw withStatus(
      "Acting HoD confirmation is required only for HoD leave.",
      400,
    );
  }

  const candidate = await prisma.user.findUnique({
    where: { id: parsed.actingHodId },
    include: { role: true },
  });

  if (!candidate) {
    throw withStatus("Selected acting HoD is invalid.", 400);
  }

  if (
    !isEligibleActingCandidate({
      candidate,
      hod: {
        id: step.leaveApplication.applicant.id,
        departmentId: step.leaveApplication.applicant.departmentId,
      },
    })
  ) {
    throw withStatus(
      "Selected acting HoD must be active, same department, and Faculty/Associate HoD.",
      400,
    );
  }

  const candidateLeave = await prisma.leaveApplication.findFirst({
    where: {
      applicantId: candidate.id,
      status: { in: [LeaveStatus.APPROVED, LeaveStatus.UNDER_REVIEW] },
      startDate: { lte: step.leaveApplication.endDate },
      endDate: { gte: step.leaveApplication.startDate },
    },
    select: { id: true },
  });

  if (candidateLeave) {
    throw withStatus(
      "Selected acting HoD is on leave in the same period. Please choose another.",
      400,
    );
  }

  const existing = await actingHodAssignment.findFirst({
    where: {
      hodId: step.leaveApplication.applicant.id,
      startDate: { lte: step.leaveApplication.endDate },
      endDate: { gte: step.leaveApplication.startDate },
    },
    select: { id: true, actingHodId: true },
  });

  const metadata = (step.leaveApplication.metadata ?? {}) as Prisma.JsonObject;

  const actingHodRequest: ActingHodRequestMeta = {
    candidateId: candidate.id,
    candidateName: candidate.name,
    requestedById: dean.id,
    requestedByName: dean.name,
    status: "PENDING_CONFIRMATION",
    requestedAt: new Date().toISOString(),
  };

  await prisma.leaveApplication.update({
    where: { id: step.leaveApplication.id },
    data: {
      metadata: {
        ...metadata,
        actingHodRequest,
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.notification.create({
    data: {
      userId: candidate.id,
      title: "Acting HoD confirmation required",
      body: `Please confirm acting HoD assignment for ${step.leaveApplication.applicant.name} (${step.leaveApplication.startDate.toISOString().slice(0, 10)} to ${step.leaveApplication.endDate.toISOString().slice(0, 10)}).`,
      type: "ACTING_HOD_CONFIRMATION",
      metadata: {
        applicationId: step.leaveApplication.id,
        hodId: step.leaveApplication.applicant.id,
        requestedById: dean.id,
      } as Prisma.InputJsonValue,
    },
  });

  return {
    ok: true,
    message:
      existing && existing.actingHodId === candidate.id
        ? `Confirmation request sent to ${candidate.name}. Existing acting assignment found for this period; candidate must still confirm this leave.`
        : `Confirmation request sent to ${candidate.name}.`,
    data: {
      alreadyAssigned: Boolean(existing),
      existingCandidateId: existing?.actingHodId ?? null,
    },
  };
};

export const respondToActingHodForLeave = async (
  payload: unknown,
  actor: SessionActor,
) => {
  const actingHodAssignment = getActingHodAssignmentDelegate();
  if (!actingHodAssignment) {
    throw withStatus(
      "Acting HoD feature is temporarily unavailable. Please run Prisma generate/migrations.",
      503,
    );
  }

  const parsed = leaveResponseSchema.parse(payload);
  const actorUser = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true },
  });
  if (!actorUser || !actorUser.isActive) {
    throw withStatus("Unable to resolve user profile.", 403);
  }

  const leave = await prisma.leaveApplication.findUnique({
    where: { id: parsed.applicationId },
    include: {
      applicant: { include: { role: true, department: true } },
    },
  });

  if (!leave) {
    throw withStatus("Leave request not found.", 404);
  }

  const request = extractActingHodRequestMeta(leave.metadata);
  if (!request || request.status !== "PENDING_CONFIRMATION") {
    throw withStatus("No pending acting HoD confirmation found.", 400);
  }

  if (request.candidateId !== actor.userId) {
    throw withStatus("This acting HoD request is not assigned to you.", 403);
  }

  const metadata = (leave.metadata ?? {}) as Prisma.JsonObject;

  if (parsed.decision === "REJECT") {
    await prisma.leaveApplication.update({
      where: { id: leave.id },
      data: {
        metadata: {
          ...metadata,
          actingHodRequest: {
            ...request,
            status: "REJECTED",
            respondedAt: new Date().toISOString(),
            responseById: actor.userId,
          },
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ok: true,
      message:
        "Acting HoD request declined. Dean must choose another candidate.",
    };
  }

  if (leave.applicant.role?.key !== RoleKey.HOD) {
    throw withStatus(
      "Acting HoD confirmation is only applicable to HoD leave.",
      400,
    );
  }

  const candidateLeave = await prisma.leaveApplication.findFirst({
    where: {
      applicantId: actor.userId,
      status: { in: [LeaveStatus.APPROVED, LeaveStatus.UNDER_REVIEW] },
      startDate: { lte: leave.endDate },
      endDate: { gte: leave.startDate },
      id: { not: leave.id },
    },
    select: { id: true },
  });

  if (candidateLeave) {
    throw withStatus(
      "You are on leave in this period. Please decline so Dean can choose another candidate.",
      400,
    );
  }

  const existing = await actingHodAssignment.findFirst({
    where: {
      hodId: leave.applicant.id,
      actingHodId: actor.userId,
      startDate: { lte: leave.endDate },
      endDate: { gte: leave.startDate },
    },
    select: { id: true },
  });

  if (!existing) {
    await actingHodAssignment.create({
      data: {
        hodId: leave.applicant.id,
        actingHodId: actor.userId,
        assignedById: request.requestedById,
        startDate: leave.startDate,
        endDate: leave.endDate,
      },
    });
  }

  await prisma.leaveApplication.update({
    where: { id: leave.id },
    data: {
      metadata: {
        ...metadata,
        actingHodRequest: {
          ...request,
          status: "CONFIRMED",
          respondedAt: new Date().toISOString(),
          responseById: actor.userId,
        },
      } as Prisma.InputJsonValue,
    },
  });

  return {
    ok: true,
    message: "Acting HoD request accepted.",
  };
};

export const getMyActingHodContext = async (actor: SessionActor) => {
  const now = new Date();
  const dayWindow = getDayWindow(now);
  const actingHodAssignment = getActingHodAssignmentDelegate();
  const activeAssignments = actingHodAssignment
    ? await actingHodAssignment.findMany({
        where: {
          actingHodId: actor.userId,
          startDate: { lte: dayWindow.end },
          endDate: { gte: dayWindow.start },
        },
        include: {
          hod: true,
          assignedBy: true,
        },
        orderBy: { startDate: "desc" },
      })
    : [];

  const leaves = await prisma.leaveApplication.findMany({
    where: {
      endDate: { gte: new Date(now.getTime() - 120 * 86400000) },
      status: {
        in: [
          LeaveStatus.SUBMITTED,
          LeaveStatus.UNDER_REVIEW,
          LeaveStatus.APPROVED,
        ],
      },
    },
    include: {
      applicant: { include: { role: true } },
      leaveType: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const pendingRequests = leaves
    .map((leave) => {
      const request = extractActingHodRequestMeta(leave.metadata);
      if (!request || request.candidateId !== actor.userId) {
        return null;
      }

      if (request.status !== "PENDING_CONFIRMATION") {
        return null;
      }

      return {
        applicationId: leave.id,
        referenceCode: leave.referenceCode,
        hodName: leave.applicant.name,
        leaveType: leave.leaveType.name,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
      };
    })
    .filter(Boolean);

  return {
    ok: true,
    data: {
      pendingRequests,
      activeAssignments: activeAssignments.map((item) => ({
        id: item.id,
        hodName: item.hod.name,
        startDate: item.startDate.toISOString(),
        endDate: item.endDate.toISOString(),
        assignedByName: item.assignedBy.name,
      })),
    },
  };
};
