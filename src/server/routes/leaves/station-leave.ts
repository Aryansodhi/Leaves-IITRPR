import { createHash, randomUUID } from "node:crypto";
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
    days: z
      .string()
      .trim()
      .regex(/^\d+$/)
      .refine((value) => Number.parseInt(value, 10) > 0),
    from: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    to: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    nature: z.string().trim().min(1),
    purpose: z.string().trim().min(1),
    contactPrefix: z
      .string()
      .trim()
      .regex(/^\+\d{1,4}$/),
    contactNumber: z
      .string()
      .trim()
      .regex(/^\d{10}$/),
    contactAddress: z.string().trim().min(1),
    place: z.string().trim().min(1),
    date: z.string().trim().min(1),
    applicantSign: z.string().trim().min(1),
  }),
  signature: z.object({
    animation: z
      .array(
        z
          .object({
            points: z
              .array(
                z.object({
                  x: z.number(),
                  y: z.number(),
                  time: z.number(),
                }),
              )
              .min(1),
          })
          .passthrough(),
      )
      .min(1),
    image: z.string().trim().startsWith("data:image/png;base64,"),
  }),
  otpVerified: z.literal(true),
});

const approvalActionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  remarks: z.string().trim().max(500).optional(),
});

const DIRECTOR_ESCALATION_THRESHOLD_DAYS = 30;
const DEFAULT_COUNTRY_CODE = "+91";

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
  switch (role) {
    case RoleKey.HOD:
      return WorkflowActor.HOD;
    case RoleKey.ASSOCIATE_HOD:
      return WorkflowActor.ASSOCIATE_HOD;
    case RoleKey.DEAN:
      return WorkflowActor.DEAN;
    case RoleKey.REGISTRAR:
      return WorkflowActor.REGISTRAR;
    case RoleKey.DIRECTOR:
      return WorkflowActor.DIRECTOR;
    default:
      return WorkflowActor.HOD;
  }
};

const stationLeaveReference = () => {
  const year = new Date().getFullYear();
  return `SL-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

const splitStoredContact = (input?: string | null) => {
  const value = input?.trim() ?? "";
  if (!value) {
    return {
      contactPrefix: DEFAULT_COUNTRY_CODE,
      contactNumber: "",
    };
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const structuredMatch = normalized.match(/^(\+\d{1,4})\s*(\d{10})/);
  if (structuredMatch) {
    return {
      contactPrefix: structuredMatch[1],
      contactNumber: structuredMatch[2],
    };
  }

  const digits = normalized.replace(/\D/g, "");
  if (digits.length >= 10) {
    const contactNumber = digits.slice(-10);
    const prefixDigits = digits.slice(0, -10);

    return {
      contactPrefix: prefixDigits ? `+${prefixDigits}` : DEFAULT_COUNTRY_CODE,
      contactNumber,
    };
  }

  return {
    contactPrefix: DEFAULT_COUNTRY_CODE,
    contactNumber: digits,
  };
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
  const latestFormData =
    typeof latestMetadata === "object" && latestMetadata
      ? (latestMetadata as Record<string, unknown>)
      : null;
  const storedContact = splitStoredContact(
    latestFormData ? String(latestFormData.contact ?? "") : profile.phone,
  );

  const defaults = {
    name: profile.name ?? "",
    designation: profile.designation ?? "",
    department: profile.department?.name ?? "",
    contactPrefix: latestFormData
      ? String(latestFormData.contactPrefix ?? storedContact.contactPrefix)
      : storedContact.contactPrefix,
    contactNumber: latestFormData
      ? String(latestFormData.contactNumber ?? storedContact.contactNumber)
      : storedContact.contactNumber,
    contactAddress: latestFormData
      ? String(latestFormData.contactAddress ?? "")
      : "",
    place: latestFormData ? String(latestFormData.place ?? "") : "",
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
      reportsTo: {
        include: { role: true },
      },
    },
  });

  if (!profile || !profile.role) {
    throw new Error("Unable to resolve applicant role.");
  }

  let approverId: string | null = null;
  let approverName: string | null = null;
  let approverRole: RoleKey | null = null;

  // STRATEGY 1: Use strictly assigned reportsTo manager from database
  if (
    profile.reportsTo &&
    profile.reportsTo.isActive &&
    profile.reportsTo.role
  ) {
    approverId = profile.reportsTo.id;
    approverName = profile.reportsTo.name;
    approverRole = profile.reportsTo.role.key;
  }
  // STRATEGY 2: Smart fallback routing based on actor's role
  else {
    if (profile.role.key === RoleKey.FACULTY) {
      const hod = await prisma.user.findFirst({
        where: {
          departmentId: profile.departmentId,
          role: { key: RoleKey.HOD },
          isActive: true,
        },
        include: { role: true },
      });
      if (hod && hod.role) {
        approverId = hod.id;
        approverName = hod.name;
        approverRole = hod.role.key;
      }
    } else if (
      profile.role.key === RoleKey.HOD ||
      profile.role.key === RoleKey.ASSOCIATE_HOD
    ) {
      const dean = await prisma.user.findFirst({
        where: { role: { key: RoleKey.DEAN }, isActive: true },
        include: { role: true },
      });
      if (dean && dean.role) {
        approverId = dean.id;
        approverName = dean.name;
        approverRole = dean.role.key;
      }
    } else if (profile.role.key === RoleKey.STAFF) {
      const reg = await prisma.user.findFirst({
        where: { role: { key: RoleKey.REGISTRAR }, isActive: true },
        include: { role: true },
      });
      if (reg && reg.role) {
        approverId = reg.id;
        approverName = reg.name;
        approverRole = reg.role.key;
      }
    }
  }

  // Final check to ensure we have a valid route
  if (!approverId || !approverName || !approverRole) {
    throw new Error(
      "Routing failed. No manager is directly assigned to you, and fallback department routing could not locate a manager.",
    );
  }

  const leaveType = await getStationLeaveType();

  const director = await prisma.user.findFirst({
    where: { isActive: true, role: { key: RoleKey.DIRECTOR } },
    include: { role: true },
  });

  const startDate =
    parseDateInput(parsed.form.from) ??
    parseDateInput(parsed.form.date) ??
    new Date();
  const endDate = parseDateInput(parsed.form.to) ?? startDate;
  if (endDate < startDate) {
    throw new Error(
      "The To date must be the same as or later than the From date.",
    );
  }

  const totalDays = Math.max(Number.parseInt(parsed.form.days, 10) || 1, 1);
  const contactDuringLeave = `${parsed.form.contactPrefix} ${parsed.form.contactNumber} | ${parsed.form.contactAddress}`;
  const needsDirectorEscalation =
    totalDays > DIRECTOR_ESCALATION_THRESHOLD_DAYS &&
    approverRole !== RoleKey.DIRECTOR;

  const stepsToCreate: Prisma.ApprovalStepCreateWithoutLeaveApplicationInput[] =
    [
      {
        sequence: 1,
        actor: toWorkflowActor(approverRole),
        status: ApprovalStatus.PENDING,
        assignedTo: {
          connect: {
            id: approverId,
          },
        },
        metadata: {
          workflowRule: "station-leave-routing-v2",
        },
      },
    ];

  if (needsDirectorEscalation && director) {
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

  const signatureTimestamp = new Date().toISOString();
  const signatureAnimationSerialized = JSON.stringify(
    parsed.signature.animation,
  );

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
      contactDuringLeave,
      directorApprovalNeeded: needsDirectorEscalation,
      submittedAt: new Date(),
      metadata: {
        formData: {
          ...parsed.form,
          contact: contactDuringLeave,
        },
        routing: {
          applicantRole: profile.role.key,
          approverRole: approverRole,
          approverName: approverName,
          directorEscalation: needsDirectorEscalation,
        },
      } as Prisma.InputJsonValue,
      approvalSteps: {
        create: stepsToCreate,
      },
    },
  });

  const signatureHash = createHash("sha256")
    .update(
      `${signatureAnimationSerialized}${application.id}${signatureTimestamp}`,
    )
    .digest("hex");

  await prisma.leaveApplication.update({
    where: { id: application.id },
    data: {
      metadata: {
        formData: {
          ...parsed.form,
          contact: contactDuringLeave,
        },
        signatureProof: {
          formId: application.id,
          animation: parsed.signature.animation,
          image: parsed.signature.image,
          timestamp: signatureTimestamp,
          hash: signatureHash,
          otpVerified: true,
        },
        routing: {
          applicantRole: profile.role.key,
          approverRole: approverRole,
          approverName: approverName,
          directorEscalation: needsDirectorEscalation,
        },
      } as Prisma.InputJsonValue,
    },
  });

  const finalApprovalNote = needsDirectorEscalation
    ? ` Final approval will additionally route to Director because the request exceeds ${DIRECTOR_ESCALATION_THRESHOLD_DAYS} days.`
    : "";

  return {
    ok: true,
    message: `Request submitted to ${approverName} (${approverRole}).${finalApprovalNote}`,
    data: {
      id: application.id,
      referenceCode: application.referenceCode,
      status: application.status,
      approverName: approverName,
      approverRole: approverRole,
      directorEscalation: needsDirectorEscalation,
      signatureTimestamp,
      signatureHash,
    },
  };
};

export const getStationLeaveApprovals = async (actor: SessionActor) => {
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

  // Relaxed query: If there is a pending step assigned to this user, grab it.
  const step = await prisma.approvalStep.findFirst({
    where: {
      leaveApplicationId: applicationId,
      assignedToId: actor.userId,
      status: { in: [ApprovalStatus.PENDING, ApprovalStatus.IN_REVIEW] },
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
      "No pending approval found for this request. It may have already been approved.",
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
