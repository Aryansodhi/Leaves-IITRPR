import { randomUUID } from "node:crypto";
import {
  ApprovalStatus,
  LeaveStatus,
  RoleKey,
  WorkflowActor,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

const stationLeavePayloadSchema = z.object({
  form: z.object({
    name: z.string().trim().min(1),
    designation: z.string().trim().min(1),
    department: z.string().trim().min(1),
    dates: z.string().trim().min(1),
    days: z.string().trim().min(1),
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
    nature: z.string().trim().min(1),
    purpose: z.string().trim().min(1),
    contact: z.string().trim().min(1),
    place: z.string().trim().min(1),
    date: z.string().trim().min(1),
    applicantSign: z.string().trim().min(1),
  }),
});

const approvalActionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  remarks: z.string().trim().max(500).optional(),
});

const DIRECTOR_ESCALATION_THRESHOLD_DAYS = 30;

const lockedApplicantRoles = new Set<RoleKey>([
  RoleKey.DEAN,
  RoleKey.REGISTRAR,
]);

const withStatus = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

type SessionActor = {
  userId: string;
  roleKey: RoleKey;
};

const parseDateInput = (raw?: string | null) => {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const native = new Date(value);
  if (!Number.isNaN(native.getTime())) return native;

  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toWorkflowActor = (role: RoleKey): WorkflowActor => {
  if (role === RoleKey.HOD) return WorkflowActor.HOD;
  if (role === RoleKey.ASSOCIATE_HOD) return WorkflowActor.ASSOCIATE_HOD;
  if (role === RoleKey.DEAN) return WorkflowActor.DEAN;
  if (role === RoleKey.REGISTRAR) return WorkflowActor.REGISTRAR;
  return WorkflowActor.DIRECTOR;
};

const looksLikeDepartmentHod = (input: {
  name?: string | null;
  designation?: string | null;
}) => {
  const haystack = `${input.name ?? ""} ${input.designation ?? ""}`
    .trim()
    .toLowerCase();

  return haystack.includes("hod") || haystack.includes("head of department");
};

const findFirstActiveUserByRole = async (role: RoleKey) => {
  const user = await prisma.user.findFirst({
    where: { isActive: true, role: { key: role } },
    include: { role: true },
  });

  if (!user || !user.role) {
    throw new Error(`${role} account not found for station leave approval.`);
  }

  return {
    id: user.id,
    name: user.name,
    roleKey: user.role.key,
  };
};

const stationLeaveReference = () => {
  const year = new Date().getFullYear();
  return `SL-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

const getStationLeaveType = async () => {
  const leaveType = await prisma.leaveType.findUnique({
    where: { code: "SL" },
    select: { id: true, name: true },
  });

  if (!leaveType) {
    throw new Error("Station Leave type (code: SL) is not configured.");
  }

  return leaveType;
};

const resolveApproverForApplicant = async (input: {
  applicantId: string;
  applicantRole: RoleKey;
  departmentId: string | null;
  reportsToId: string | null;
}) => {
  if (input.applicantRole === RoleKey.FACULTY) {
    const departmentApprovers = input.departmentId
      ? await prisma.user.findMany({
          where: {
            isActive: true,
            departmentId: input.departmentId,
            role: {
              key: {
                in: [RoleKey.HOD, RoleKey.ASSOCIATE_HOD],
              },
            },
          },
          include: { role: true },
        })
      : [];

    const departmentApprover =
      departmentApprovers.find(
        (candidate) => candidate.role?.key === RoleKey.HOD,
      ) ??
      departmentApprovers.find(
        (candidate) => candidate.role?.key === RoleKey.ASSOCIATE_HOD,
      ) ??
      null;

    const reportingManager = input.reportsToId
      ? await prisma.user.findFirst({
          where: {
            id: input.reportsToId,
            isActive: true,
          },
          include: { role: true },
        })
      : null;

    const inferredDepartmentHod =
      !departmentApprover && input.departmentId
        ? await prisma.user.findFirst({
            where: {
              isActive: true,
              departmentId: input.departmentId,
              OR: [
                { name: { contains: "hod", mode: "insensitive" } },
                {
                  designation: {
                    contains: "hod",
                    mode: "insensitive",
                  },
                },
                {
                  designation: {
                    contains: "head of department",
                    mode: "insensitive",
                  },
                },
              ],
            },
            include: { role: true },
          })
        : null;

    const fallbackApprover =
      departmentApprover ??
      (reportingManager &&
      (!input.departmentId ||
        reportingManager.departmentId === input.departmentId) &&
      (reportingManager.role?.key === RoleKey.HOD ||
        reportingManager.role?.key === RoleKey.ASSOCIATE_HOD ||
        looksLikeDepartmentHod(reportingManager))
        ? reportingManager
        : null) ??
      inferredDepartmentHod;

    if (!fallbackApprover) {
      throw new Error(
        "No HoD found for this faculty member's department. Please contact admin.",
      );
    }

    return {
      approverId: fallbackApprover.id,
      approverName: fallbackApprover.name,
      approverRole:
        fallbackApprover.role?.key === RoleKey.ASSOCIATE_HOD
          ? RoleKey.ASSOCIATE_HOD
          : RoleKey.HOD,
    };
  }

  if (input.applicantRole === RoleKey.STAFF) {
    const registrar = await findFirstActiveUserByRole(RoleKey.REGISTRAR);

    return {
      approverId: registrar.id,
      approverName: registrar.name,
      approverRole: registrar.roleKey,
    };
  }

  if (input.applicantRole === RoleKey.HOD) {
    const dean = await findFirstActiveUserByRole(RoleKey.DEAN);

    return {
      approverId: dean.id,
      approverName: dean.name,
      approverRole: dean.roleKey,
    };
  }

  throw new Error(
    "Station leave workflow is only configured for Faculty, Staff, and HoD applicants.",
  );
};

export const getStationLeaveBootstrap = async (actor: SessionActor) => {
  if (lockedApplicantRoles.has(actor.roleKey)) {
    throw withStatus(
      "Station leave form is locked for Dean and Registrar.",
      403,
    );
  }

  const [profile, leaveType] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actor.userId },
      include: {
        department: true,
        role: true,
      },
    }),
    getStationLeaveType(),
  ]);

  if (!profile) {
    throw new Error("User profile not found.");
  }

  const history = await prisma.leaveApplication.findMany({
    where: {
      applicantId: actor.userId,
      leaveTypeId: leaveType.id,
      stationLeave: true,
      status: { not: LeaveStatus.DRAFT },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      approvalSteps: {
        orderBy: { sequence: "asc" },
        include: {
          assignedTo: {
            include: { role: true },
          },
        },
      },
    },
  });

  const latestMetadata =
    (history[0]?.metadata as Prisma.JsonObject | null)?.formData ?? null;

  const defaults = {
    name: profile.name ?? "",
    designation: profile.designation ?? "",
    department: profile.department?.name ?? "",
    contact:
      profile.phone ??
      (typeof latestMetadata === "object" && latestMetadata
        ? String((latestMetadata as Record<string, unknown>).contact ?? "")
        : ""),
    place:
      typeof latestMetadata === "object" && latestMetadata
        ? String((latestMetadata as Record<string, unknown>).place ?? "")
        : "",
    date: new Date().toLocaleDateString("en-GB"),
  };

  return {
    ok: true,
    data: {
      defaults,
      history: history.map((item) => ({
        id: item.id,
        referenceCode: item.referenceCode,
        from: item.startDate.toISOString(),
        to: item.endDate.toISOString(),
        totalDays: item.totalDays,
        status: item.status,
        submittedAt:
          item.submittedAt?.toISOString() ?? item.createdAt.toISOString(),
        approver:
          item.approvalSteps[0]?.assignedTo?.name ??
          item.approvalSteps[0]?.assignedTo?.role?.name ??
          "Pending assignment",
      })),
      leaveType: leaveType.name,
    },
  };
};

export const submitStationLeave = async (
  payload: unknown,
  actor: SessionActor,
) => {
  if (lockedApplicantRoles.has(actor.roleKey)) {
    throw withStatus(
      "Station leave form is locked for Dean and Registrar.",
      403,
    );
  }

  const parsed = stationLeavePayloadSchema.parse(payload);

  const profile = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: {
      role: true,
      department: true,
    },
  });

  if (!profile || !profile.role) {
    throw new Error("Unable to resolve applicant role.");
  }

  const leaveType = await getStationLeaveType();
  const director = await findFirstActiveUserByRole(RoleKey.DIRECTOR);
  const approver = await resolveApproverForApplicant({
    applicantId: actor.userId,
    applicantRole: profile.role.key,
    departmentId: profile.departmentId,
    reportsToId: profile.reportsToId,
  });

  const startDate =
    parseDateInput(parsed.form.from) ??
    parseDateInput(parsed.form.date) ??
    new Date();
  const endDate = parseDateInput(parsed.form.to) ?? startDate;
  const totalDays = Math.max(Number.parseInt(parsed.form.days, 10) || 1, 1);
  const needsDirectorEscalation =
    totalDays > DIRECTOR_ESCALATION_THRESHOLD_DAYS &&
    approver.approverRole !== RoleKey.DIRECTOR;

  const stepsToCreate: Prisma.ApprovalStepCreateWithoutLeaveApplicationInput[] =
    [
      {
        sequence: 1,
        actor: toWorkflowActor(approver.approverRole),
        status: ApprovalStatus.PENDING,
        assignedTo: {
          connect: {
            id: approver.approverId,
          },
        },
        metadata: {
          workflowRule: "station-leave-routing-v2",
        },
      },
    ];

  if (needsDirectorEscalation) {
    stepsToCreate.push({
      sequence: 2,
      actor: WorkflowActor.DIRECTOR,
      status: ApprovalStatus.PENDING,
      assignedTo: {
        connect: {
          id: director.id,
        },
      },
      metadata: {
        workflowRule: "station-leave-routing-v2",
        escalationReason: "duration-threshold",
        thresholdDays: DIRECTOR_ESCALATION_THRESHOLD_DAYS,
      },
    });
  }

  const application = await prisma.leaveApplication.create({
    data: {
      referenceCode: stationLeaveReference(),
      applicantId: actor.userId,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      totalDays,
      status: LeaveStatus.UNDER_REVIEW,
      purpose: parsed.form.purpose,
      destination: parsed.form.place,
      stationLeave: true,
      contactDuringLeave: parsed.form.contact,
      directorApprovalNeeded: needsDirectorEscalation,
      submittedAt: new Date(),
      metadata: {
        formData: parsed.form,
        routing: {
          applicantRole: profile.role.key,
          approverRole: approver.approverRole,
          approverName: approver.approverName,
          directorEscalation: needsDirectorEscalation,
        },
      },
      approvalSteps: {
        create: stepsToCreate,
      },
    },
  });

  const finalApprovalNote = needsDirectorEscalation
    ? ` Final approval will additionally route to Director because the request exceeds ${DIRECTOR_ESCALATION_THRESHOLD_DAYS} days.`
    : "";

  return {
    ok: true,
    message: `Request submitted to ${approver.approverName} (${approver.approverRole}).${finalApprovalNote}`,
    data: {
      id: application.id,
      referenceCode: application.referenceCode,
      status: application.status,
      approverName: approver.approverName,
      approverRole: approver.approverRole,
      directorEscalation: needsDirectorEscalation,
    },
  };
};

export const getStationLeaveApprovals = async (actor: SessionActor) => {
  const steps = await prisma.approvalStep.findMany({
    where: {
      assignedToId: actor.userId,
      leaveApplication: {
        stationLeave: true,
        leaveType: { code: "SL" },
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
                include: {
                  role: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
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

export const decideStationLeaveApproval = async (
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
        stationLeave: true,
        leaveType: { code: "SL" },
      },
    },
    include: {
      leaveApplication: {
        include: {
          approvalSteps: true,
        },
      },
    },
  });

  if (!step) {
    throw withStatus(
      "No pending station leave approval found for this request.",
      404,
    );
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

  const appStatus =
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
        status: appStatus,
        approvedAt:
          parsed.decision === "APPROVE" && !remainingPendingSteps ? now : null,
      },
    }),
  );

  await prisma.$transaction(transactionQueries);

  return {
    ok: true,
    message:
      parsed.decision === "APPROVE"
        ? "Station leave request approved."
        : "Station leave request rejected.",
  };
};
