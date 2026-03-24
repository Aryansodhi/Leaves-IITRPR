import { LeaveStatus, RoleKey } from "@prisma/client";
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

const isEarnedLeaveType = (input: {
  code?: string | null;
  name?: string | null;
}) =>
  (input.code ?? "").toUpperCase() === "EL" ||
  (input.name ?? "").toLowerCase().includes("earned");

const findEarnedLeaveWindow = async (input: {
  hodId: string;
  startDate: Date;
  endDate: Date;
}) => {
  const record = await prisma.leaveApplication.findFirst({
    where: {
      applicantId: input.hodId,
      status: LeaveStatus.APPROVED,
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
      leaveType: {
        OR: [
          { code: "EL" },
          { name: { contains: "Earned", mode: "insensitive" } },
        ],
      },
    },
    include: { leaveType: true },
    orderBy: { startDate: "desc" },
  });

  if (!record || !isEarnedLeaveType(record.leaveType)) return null;

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

export const getActingHodStatus = async (actor: SessionActor) => {
  const hod = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true, department: true },
  });

  if (!hod || hod.role?.key !== RoleKey.HOD) {
    throw withStatus("Acting HoD assignment is limited to HoD accounts.", 403);
  }

  const now = new Date();
  const activeLeave = await findEarnedLeaveWindow({
    hodId: hod.id,
    startDate: now,
    endDate: now,
  });

  const activeAssignment = await prisma.actingHodAssignment.findFirst({
    where: {
      hodId: hod.id,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      actingHod: true,
      assignedBy: true,
    },
    orderBy: { startDate: "desc" },
  });

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

  const activeLeave = await findEarnedLeaveWindow({
    hodId: hod.id,
    startDate,
    endDate,
  });

  if (!activeLeave) {
    throw withStatus(
      "No approved earned leave found for the selected period.",
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

  const existing = await prisma.actingHodAssignment.findFirst({
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

  const assignment = await prisma.actingHodAssignment.create({
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
  const hodsOnLeave = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { key: RoleKey.HOD },
      leaveApplications: {
        some: {
          status: LeaveStatus.APPROVED,
          startDate: { lte: now },
          endDate: { gte: now },
          leaveType: {
            OR: [
              { code: "EL" },
              { name: { contains: "Earned", mode: "insensitive" } },
            ],
          },
        },
      },
    },
    include: { department: true },
    orderBy: { name: "asc" },
  });

  const items = await Promise.all(
    hodsOnLeave.map(async (hod) => {
      const activeLeave = await findEarnedLeaveWindow({
        hodId: hod.id,
        startDate: now,
        endDate: now,
      });
      const activeAssignment = await prisma.actingHodAssignment.findFirst({
        where: {
          hodId: hod.id,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: { actingHod: true, assignedBy: true },
        orderBy: { startDate: "desc" },
      });

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

  const activeLeave = await findEarnedLeaveWindow({
    hodId: hod.id,
    startDate,
    endDate,
  });

  if (!activeLeave) {
    throw withStatus(
      "No approved earned leave found for the selected HoD period.",
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

  const existing = await prisma.actingHodAssignment.findFirst({
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

  const assignment = await prisma.actingHodAssignment.create({
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
