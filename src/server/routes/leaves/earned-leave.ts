import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { type Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import {
  SESSION_OFFSET,
  SESSION_VALUES,
  computeSessionLeaveDays,
  formatSessionDays,
  resolveCurrentSession,
} from "@/lib/leave-session";
import {
  sendLeaveStatusUpdateEmail,
  sendLeaveSubmissionEmail,
} from "@/server/email/mailer";

// NOTE: We intentionally model Prisma enums as string unions here to avoid
// editor/lint issues when Prisma types are out of sync. Prisma Client accepts
// these enum values as strings at runtime.
const RoleKey = {
  FACULTY: "FACULTY",
  STAFF: "STAFF",
  HOD: "HOD",
  ASSOCIATE_HOD: "ASSOCIATE_HOD",
  DEAN: "DEAN",
  REGISTRAR: "REGISTRAR",
  DIRECTOR: "DIRECTOR",
  ACCOUNTS: "ACCOUNTS",
  ESTABLISHMENT: "ESTABLISHMENT",
  ADMIN: "ADMIN",
} as const;
type RoleKey = (typeof RoleKey)[keyof typeof RoleKey];

const WorkflowActor = {
  APPLICANT: "APPLICANT",
  HOD: "HOD",
  ASSOCIATE_HOD: "ASSOCIATE_HOD",
  DEAN: "DEAN",
  REGISTRAR: "REGISTRAR",
  DIRECTOR: "DIRECTOR",
  ACCOUNTS: "ACCOUNTS",
  ESTABLISHMENT: "ESTABLISHMENT",
} as const;
type WorkflowActor = (typeof WorkflowActor)[keyof typeof WorkflowActor];

const ApprovalStatus = {
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ESCALATED: "ESCALATED",
  SKIPPED: "SKIPPED",
} as const;
type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

const LeaveStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  RETURNED: "RETURNED",
  CANCELLED: "CANCELLED",
} as const;
type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus];

const DIGITAL_SIGNATURE_VALUE = "DIGITALLY_SIGNED";

const earnedLeavePayloadSchema = z
  .object({
    form: z.object({
      name: z.string().trim().min(1),
      post: z.string().trim().min(1),
      department: z.string().trim().min(1),
      leaveType: z.string().trim().min(1),
      fromDate: z.string().trim().min(1),
      toDate: z.string().trim().min(1),
      fromSession: z.enum(SESSION_VALUES),
      toSession: z.enum(SESSION_VALUES),
      days: z
        .string()
        .trim()
        .regex(/^\d+(\.5)?$/),
      purpose: z.string().trim().min(1),
      arrangements: z.string().trim().optional(),
      ltc: z.enum(["PROPOSE", "NOT_PROPOSE"]),
      address: z.string().trim().min(1),
      contactNo: z
        .string()
        .trim()
        .regex(/^\d{10}$/),
      pin: z
        .string()
        .trim()
        .regex(/^\d{6}$/),
      stationYesNo: z.preprocess(
        (value) => {
          if (typeof value !== "string") return value;
          const normalized = value.trim().toLowerCase();
          if (!normalized) return undefined;
          if (normalized === "yes") return "Yes";
          if (normalized === "no") return "No";
          return value;
        },
        z.enum(["Yes", "No"]).optional(),
      ),
      stationFrom: z.string().trim().optional(),
      stationTo: z.string().trim().optional(),
      prefixFromDate: z.string().trim().optional(),
      prefixToDate: z.string().trim().optional(),
      prefixDays: z.string().trim().optional(),
      suffixFromDate: z.string().trim().optional(),
      suffixToDate: z.string().trim().optional(),
      suffixDays: z.string().trim().optional(),
      applicantSignature: z.string().trim().optional(),
      applicantSignatureDate: z.string().trim().optional(),
    }),
    signature: z
      .object({
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
      })
      .optional(),
    otpVerified: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    const usesDigitalSignature =
      value.form.applicantSignature === DIGITAL_SIGNATURE_VALUE;

    if (usesDigitalSignature) {
      if (!value.signature) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["signature"],
          message: "Digital signature image is required.",
        });
      }

      if (!value.otpVerified) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["otpVerified"],
          message: "OTP verification is required for digital signature.",
        });
      }
    }
  });

const approvalActionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  remarks: z.string().trim().max(500).optional(),
  recommended: z.enum(["RECOMMENDED", "NOT_RECOMMENDED"]).optional(),
  hodSignature: z.string().trim().optional(),
  accountsSignature: z.string().trim().optional(),
  balance: z.string().trim().optional(), // for accounts to fill
  decisionDate: z.string().trim().optional(),
});

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

// threshold used in multiple leave workflows when director approval is required
const DIRECTOR_ESCALATION_THRESHOLD_DAYS = 30;

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
    case RoleKey.ACCOUNTS:
      return WorkflowActor.ACCOUNTS;
    default:
      return WorkflowActor.HOD;
  }
};

const earnedLeaveReference = () => {
  const year = new Date().getFullYear();
  return `EL-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

const getEarnedLeaveType = async () => {
  const leaveType = await prisma.leaveType.findFirst({
    where: {
      OR: [
        { code: "EL" },
        { name: { contains: "Earned Leave", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!leaveType) {
    throw new Error("Earned Leave type is not configured.");
  }

  return leaveType;
};

export const submitEarnedLeave = async (
  payload: unknown,
  actor: SessionActor,
) => {
  const parsed = earnedLeavePayloadSchema.parse(payload);

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

  if (!profile) {
    throw new Error("Unable to resolve applicant role.");
  }

  let approverId: string | null = null;
  let approverName: string | null = null;
  let approverRole: RoleKey | null = null;

  const applicantRole = profile.role?.key ?? actor.roleKey;
  const reportsToRole =
    profile.reportsTo?.role?.key && profile.reportsTo.isActive
      ? profile.reportsTo.role.key
      : null;

  const setApproverFromReportsTo = (allowedRoles: RoleKey[]) => {
    if (
      profile.reportsTo &&
      profile.reportsTo.isActive &&
      profile.reportsTo.role &&
      allowedRoles.includes(profile.reportsTo.role.key)
    ) {
      approverId = profile.reportsTo.id;
      approverName = profile.reportsTo.name;
      approverRole = profile.reportsTo.role.key;
      return true;
    }
    return false;
  };

  // Routing logic based on applicant role.
  // NOTE: Even if reportsTo is set, we only accept it if it matches the expected
  // controlling officer role for that applicant type.
  if (applicantRole === RoleKey.FACULTY) {
    // Faculty → HOD (or Associate HoD)
    const usedReportsTo = setApproverFromReportsTo([
      RoleKey.HOD,
      RoleKey.ASSOCIATE_HOD,
    ]);
    if (!usedReportsTo) {
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
    }
  } else if (applicantRole === RoleKey.STAFF) {
    // Staff → Registrar
    const usedReportsTo = setApproverFromReportsTo([RoleKey.REGISTRAR]);
    if (!usedReportsTo) {
      const registrar = await prisma.user.findFirst({
        where: { role: { key: RoleKey.REGISTRAR }, isActive: true },
        include: { role: true },
      });
      if (registrar && registrar.role) {
        approverId = registrar.id;
        approverName = registrar.name;
        approverRole = registrar.role.key;
      }
    }
  } else if (
    applicantRole === RoleKey.HOD ||
    applicantRole === RoleKey.ASSOCIATE_HOD
  ) {
    // HoD / Associate HoD → Dean
    const usedReportsTo = setApproverFromReportsTo([RoleKey.DEAN]);
    if (!usedReportsTo) {
      const dean = await prisma.user.findFirst({
        where: { role: { key: RoleKey.DEAN }, isActive: true },
        include: { role: true },
      });
      if (dean && dean.role) {
        approverId = dean.id;
        approverName = dean.name;
        approverRole = dean.role.key;
      }
    }
  } else {
    throw withStatus(
      `Earned Leave routing is not configured for applicant role: ${applicantRole}.`,
      400,
    );
  }

  // Final check to ensure we have a valid route
  if (!approverId || !approverName || !approverRole) {
    throw new Error(
      `Routing failed for applicantRole=${applicantRole} (reportsToRole=${reportsToRole ?? "none"}). ` +
        "Please ensure your User.reportsTo is set correctly and the controlling officer account is active.",
    );
  }

  const leaveType = await getEarnedLeaveType();

  const startDate = parseDateInput(parsed.form.fromDate);
  const endDate = parseDateInput(parsed.form.toDate);

  if (!startDate || !endDate) {
    throw new Error(
      "Invalid date format. Please provide valid From and To dates.",
    );
  }

  if (endDate < startDate) {
    throw new Error(
      "The To date must be the same as or later than the From date.",
    );
  }

  const computedDays = computeSessionLeaveDays(
    startDate,
    parsed.form.fromSession,
    endDate,
    parsed.form.toSession,
  );
  if (!computedDays) {
    throw new Error(
      "The selected date/session window is invalid. Please ensure To is after From.",
    );
  }

  const today = new Date();
  const todayDate = new Date(`${today.toISOString().slice(0, 10)}T00:00:00`);
  const endMarker =
    endDate.getTime() / 86400000 + SESSION_OFFSET[parsed.form.toSession];
  const nowMarker =
    todayDate.getTime() / 86400000 + SESSION_OFFSET[resolveCurrentSession()];
  if (endMarker <= nowMarker) {
    throw new Error(
      "The leave end date/session must be after the current date/session.",
    );
  }

  const totalDays = Math.max(Math.ceil(computedDays), 1);
  const preciseDays = formatSessionDays(computedDays);

  // Build contact during leave
  const contactParts: string[] = [];
  if (parsed.form.contactNo) {
    contactParts.push(parsed.form.contactNo);
  }
  if (parsed.form.address) {
    contactParts.push(parsed.form.address);
  }
  if (parsed.form.pin) {
    contactParts.push(`PIN: ${parsed.form.pin}`);
  }
  const contactDuringLeave =
    contactParts.length > 0 ? contactParts.join(", ") : null;

  // Check if station leave is required
  const stationLeave = parsed.form.stationYesNo === "Yes";
  const stationFrom =
    stationLeave && parsed.form.stationFrom
      ? parseDateInput(parsed.form.stationFrom)
      : null;
  const stationTo =
    stationLeave && parsed.form.stationTo
      ? parseDateInput(parsed.form.stationTo)
      : null;

  // Check if director escalation is needed (before using in metadata)
  const needsDirectorEscalation =
    totalDays > DIRECTOR_ESCALATION_THRESHOLD_DAYS &&
    approverRole !== RoleKey.DIRECTOR;

  // Build metadata with all form data and routing trace
  const metadata: Record<string, unknown> = {
    formData: {
      ...parsed.form,
      days: preciseDays,
    },
    routing: {
      applicantRole,
      approverRole: approverRole,
      approverName: approverName,
      directorEscalation: needsDirectorEscalation,
    },
  };

  // Add prefix/suffix dates if provided
  if (parsed.form.prefixFromDate || parsed.form.prefixToDate) {
    metadata.prefix = {
      from: parsed.form.prefixFromDate,
      to: parsed.form.prefixToDate,
      days: parsed.form.prefixDays,
    };
  }

  if (parsed.form.suffixFromDate || parsed.form.suffixToDate) {
    metadata.suffix = {
      from: parsed.form.suffixFromDate,
      to: parsed.form.suffixToDate,
      days: parsed.form.suffixDays,
    };
  }

  if (stationLeave && stationFrom && stationTo) {
    metadata.stationLeave = {
      from: stationFrom.toISOString(),
      to: stationTo.toISOString(),
    };
  }

  // determine additional actors for the new multi-stage workflow
  const accountUser = await prisma.user.findFirst({
    where: { isActive: true, role: { key: RoleKey.ACCOUNTS } },
    include: { role: true },
  });

  const deanUser = await prisma.user.findFirst({
    where: { isActive: true, role: { key: RoleKey.DEAN } },
    include: { role: true },
  });

  const registrarUser = await prisma.user.findFirst({
    where: { isActive: true, role: { key: RoleKey.REGISTRAR } },
    include: { role: true },
  });

  const directorUser = await prisma.user.findFirst({
    where: { isActive: true, role: { key: RoleKey.DIRECTOR } },
    include: { role: true },
  });

  // sanctioner is dean for faculty/HOD, registrar for staff
  const sanctionerUser =
    applicantRole === RoleKey.STAFF ? registrarUser : deanUser;

  const stepsToCreate: Prisma.ApprovalStepCreateWithoutLeaveApplicationInput[] =
    [];

  // controlling authority step
  stepsToCreate.push({
    sequence: 1,
    actor: toWorkflowActor(approverRole),
    status: ApprovalStatus.PENDING,
    assignedTo: {
      connect: {
        id: approverId,
      },
    },
    metadata: {
      workflowRule: "earned-leave-routing-ca",
    },
  });

  // accounts review/fill details
  if (accountUser) {
    stepsToCreate.push({
      sequence: stepsToCreate.length + 1,
      actor: WorkflowActor.ACCOUNTS,
      status: ApprovalStatus.PENDING,
      assignedTo: {
        connect: { id: accountUser.id },
      },
      metadata: {
        workflowRule: "earned-leave-routing-accounts",
      },
    });
  }

  // sanctioning officer (Dean for faculty/HOD, Registrar for staff)
  if (sanctionerUser && sanctionerUser.role) {
    stepsToCreate.push({
      sequence: stepsToCreate.length + 1,
      actor: toWorkflowActor(sanctionerUser.role.key),
      status: ApprovalStatus.PENDING,
      assignedTo: {
        connect: { id: sanctionerUser.id },
      },
      metadata: {
        workflowRule: "earned-leave-routing-sanction",
      },
    });
  }

  // optional director escalation only when leave exceeds threshold
  if (needsDirectorEscalation && directorUser) {
    stepsToCreate.push({
      sequence: stepsToCreate.length + 1,
      actor: WorkflowActor.DIRECTOR,
      status: ApprovalStatus.PENDING,
      assignedTo: {
        connect: { id: directorUser.id },
      },
      metadata: {
        workflowRule: "earned-leave-routing-director",
        escalationReason: "duration-threshold",
        thresholdDays: DIRECTOR_ESCALATION_THRESHOLD_DAYS,
      },
    });
  }

  const signatureTimestamp = new Date().toISOString();
  const hasDigitalSignature = Boolean(parsed.signature && parsed.otpVerified);
  const signatureAnimationSerialized = hasDigitalSignature
    ? JSON.stringify(parsed.signature?.animation)
    : "";

  const application = await prisma.leaveApplication.create({
    data: {
      referenceCode: earnedLeaveReference(),
      applicantId: actor.userId,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      totalDays,
      status: LeaveStatus.UNDER_REVIEW,
      purpose: parsed.form.purpose,
      destination: parsed.form.address || null,
      stationLeave,
      ltc: parsed.form.ltc === "PROPOSE",
      contactDuringLeave,
      submittedAt: new Date(),
      metadata: metadata as Prisma.InputJsonValue,
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

  const signatureProof = hasDigitalSignature
    ? {
        formId: application.id,
        animation: parsed.signature?.animation,
        image: parsed.signature?.image,
        timestamp: signatureTimestamp,
        hash: signatureHash,
        otpVerified: true,
      }
    : {
        mode: "TYPED",
        value: parsed.form.applicantSignature,
        timestamp: signatureTimestamp,
      };

  const metadataWithSignature: Record<string, unknown> = {
    ...metadata,
    signatureProof,
  };

  await prisma.leaveApplication.update({
    where: { id: application.id },
    data: {
      metadata: metadataWithSignature as Prisma.InputJsonValue,
    },
  });

  try {
    await sendLeaveSubmissionEmail({
      to: profile.email,
      applicantName: profile.name,
      referenceCode: application.referenceCode,
      leaveType: leaveType.name,
      status: application.status,
      startDate,
      endDate,
      totalDays,
      actionLabel:
        "Your earned leave request has been submitted and routed for approval.",
      actionBy: approverName,
    });
  } catch (error) {
    console.error("Failed to send earned leave submission email", error);
  }

  const finalApprovalNote = needsDirectorEscalation
    ? ` The workflow will additionally route to Director due to duration > ${DIRECTOR_ESCALATION_THRESHOLD_DAYS} days.`
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

export const approveEarnedLeave = async (
  applicationId: string,
  payload: unknown,
  actor: SessionActor,
) => {
  const parsed = approvalActionSchema.parse(payload);

  const application = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      approvalSteps: {
        where: {
          assignedToId: actor.userId,
          status: ApprovalStatus.PENDING,
        },
        orderBy: { sequence: "asc" },
      },
      leaveType: true,
      applicant: {
        include: { role: true },
      },
    },
  });

  if (!application) {
    throw withStatus("Leave application not found.", 404);
  }

  if (application.approvalSteps.length === 0) {
    throw withStatus("No pending approval step found for you.", 403);
  }

  const step = application.approvalSteps[0];
  const decision =
    parsed.decision === "APPROVE"
      ? ApprovalStatus.APPROVED
      : ApprovalStatus.REJECTED;

  let nextStatus: LeaveStatus = LeaveStatus.UNDER_REVIEW;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update the approval step
    await tx.approvalStep.update({
      where: { id: step.id },
      data: {
        status: decision,
        remarks: parsed.remarks || null,
        actedById: actor.userId,
        actedAt: new Date(),
        metadata: {
          ...(step.metadata as Record<string, unknown>),
          ...(parsed.recommended && { recommended: parsed.recommended }),
          ...(parsed.hodSignature && { hodSignature: parsed.hodSignature }),
          ...(parsed.decisionDate && { decisionDate: parsed.decisionDate }),
        },
      },
    });

    // Update application status
    if (decision === ApprovalStatus.REJECTED) {
      nextStatus = LeaveStatus.REJECTED;
      await tx.leaveApplication.update({
        where: { id: applicationId },
        data: {
          status: LeaveStatus.REJECTED,
        },
      });
    } else {
      // Check if there are more steps
      const remainingSteps = await tx.approvalStep.findMany({
        where: {
          leaveApplicationId: applicationId,
          status: ApprovalStatus.PENDING,
        },
      });

      if (remainingSteps.length === 0) {
        nextStatus = LeaveStatus.APPROVED;
        // All steps approved
        await tx.leaveApplication.update({
          where: { id: applicationId },
          data: {
            status: LeaveStatus.APPROVED,
            approvedAt: new Date(),
          },
        });
      } else {
        nextStatus = LeaveStatus.UNDER_REVIEW;
        // Still pending other approvals
        await tx.leaveApplication.update({
          where: { id: applicationId },
          data: {
            status: LeaveStatus.UNDER_REVIEW,
          },
        });
      }
    }
  });

  try {
    const actorUser = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { name: true },
    });

    await sendLeaveStatusUpdateEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
      referenceCode: application.referenceCode,
      leaveType: application.leaveType.name,
      status: nextStatus,
      startDate: application.startDate,
      endDate: application.endDate,
      totalDays: application.totalDays,
      actionLabel:
        parsed.decision === "APPROVE"
          ? "Your earned leave request has been updated to Approved."
          : "Your earned leave request has been updated to Rejected.",
      actionBy: actorUser?.name ?? null,
      remarks: parsed.remarks ?? null,
    });
  } catch (error) {
    console.error("Failed to send earned leave status email", error);
  }

  return {
    ok: true,
    message: `Leave application ${parsed.decision === "APPROVE" ? "approved" : "rejected"} successfully.`,
  };
};
