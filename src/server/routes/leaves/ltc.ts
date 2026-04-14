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
import { sendLeaveSubmissionEmail } from "@/server/email/mailer";

const DIGITAL_SIGNATURE_VALUE = "DIGITALLY_SIGNED";

const SESSION_VALUES = ["MORNING", "AFTERNOON", "EVENING"] as const;

type DaySession = (typeof SESSION_VALUES)[number];

const SESSION_OFFSET: Record<DaySession, number> = {
  MORNING: 0,
  AFTERNOON: 0.5,
  EVENING: 1,
};

type SessionActor = {
  userId: string;
  roleKey: RoleKey;
};

type ResolvedApprover = {
  id: string;
  name: string;
  role: RoleKey;
  rule: string;
};

const ensureAnyActiveUserByRole = async (role: RoleKey, message: string) => {
  const exists = await prisma.user.findFirst({
    where: { isActive: true, role: { key: role } },
    select: { id: true },
  });

  if (!exists) {
    throw new Error(message);
  }
};

const withStatus = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

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

const computeSessionLeaveDays = (
  fromDate: Date,
  fromSession: DaySession,
  toDate: Date,
  toSession: DaySession,
) => {
  const fromMarker =
    fromDate.getTime() / 86400000 + SESSION_OFFSET[fromSession];
  const toMarker = toDate.getTime() / 86400000 + SESSION_OFFSET[toSession];
  const value = Number((toMarker - fromMarker).toFixed(1));
  return value > 0 ? value : null;
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
    case RoleKey.ESTABLISHMENT:
      return WorkflowActor.ESTABLISHMENT;
    case RoleKey.ACCOUNTS:
      return WorkflowActor.ACCOUNTS;
    case RoleKey.DIRECTOR:
      return WorkflowActor.DIRECTOR;
    default:
      return WorkflowActor.HOD;
  }
};

const ltcReference = () => {
  const year = new Date().getFullYear();
  return `LTC-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

const getLtcLeaveType = async () => {
  const leaveType = await prisma.leaveType.findFirst({
    where: {
      OR: [
        { code: "LTC" },
        { name: { contains: "LTC", mode: "insensitive" } },
        { name: { contains: "Leave Travel", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!leaveType) {
    throw new Error("LTC LeaveType is not configured.");
  }

  return leaveType;
};

const ltcPayloadSchema = z
  .object({
    form: z
      .object({
        leaveFrom: z
          .string()
          .trim()
          .refine((value) => parseDateInput(value) !== null, {
            message: "Invalid leaveFrom date.",
          }),
        leaveTo: z
          .string()
          .trim()
          .refine((value) => parseDateInput(value) !== null, {
            message: "Invalid leaveTo date.",
          }),
        leaveFromSession: z.enum(SESSION_VALUES),
        leaveToSession: z.enum(SESSION_VALUES),
        leaveDays: z
          .string()
          .trim()
          .regex(/^\d+(\.5)?$/, "Invalid leaveDays format."),
        applicantSignature: z.string().trim().min(1),
        placeToVisit: z.string().trim().optional(),
      })
      .passthrough(),
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

const resolveLtcControllingApprover = async (input: {
  departmentId: string | null;
  reportsTo?: {
    id: string;
    name: string;
    isActive: boolean;
    role?: { key: RoleKey } | null;
  } | null;
}): Promise<ResolvedApprover | null> => {
  if (input.departmentId) {
    const hod = await prisma.user.findFirst({
      where: {
        isActive: true,
        departmentId: input.departmentId,
        role: { key: RoleKey.HOD },
      },
      include: { role: true },
    });

    if (hod?.role) {
      return {
        id: hod.id,
        name: hod.name,
        role: hod.role.key,
        rule: "ltc-routing:department-hod",
      };
    }

    const associateHod = await prisma.user.findFirst({
      where: {
        isActive: true,
        departmentId: input.departmentId,
        role: { key: RoleKey.ASSOCIATE_HOD },
      },
      include: { role: true },
    });

    if (associateHod?.role) {
      return {
        id: associateHod.id,
        name: associateHod.name,
        role: associateHod.role.key,
        rule: "ltc-routing:department-associate-hod",
      };
    }
  }

  const reportsToRole =
    input.reportsTo?.isActive && input.reportsTo.role
      ? input.reportsTo.role.key
      : null;

  if (
    reportsToRole === RoleKey.HOD ||
    reportsToRole === RoleKey.ASSOCIATE_HOD
  ) {
    return {
      id: input.reportsTo!.id,
      name: input.reportsTo!.name,
      role: reportsToRole,
      rule: "ltc-routing:reportsTo",
    };
  }

  // Last-resort fallback: if reportsTo exists but role mapping is missing/misconfigured,
  // still route to that user and treat them as the HoD workflow actor.
  if (input.reportsTo?.isActive) {
    return {
      id: input.reportsTo.id,
      name: input.reportsTo.name,
      role: RoleKey.HOD,
      rule: "ltc-routing:reportsTo-forced",
    };
  }

  return null;
};

export const submitLtc = async (payload: unknown, actor: SessionActor) => {
  const parsed = ltcPayloadSchema.parse(payload);

  // Office-section fields must not be set by the applicant submission.
  // They are intended for downstream processing by Establishment/Accounts/etc.
  const sanitizedForm = { ...parsed.form } as Record<string, unknown>;
  Object.keys(sanitizedForm).forEach((key) => {
    if (
      key.startsWith("est") ||
      key.startsWith("accounts") ||
      key.startsWith("audit") ||
      key === "freshRecruitDate"
    ) {
      delete sanitizedForm[key];
    }
  });

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
    throw new Error("Unable to resolve applicant profile.");
  }

  const applicantRole = profile.role?.key ?? actor.roleKey;

  const leaveType = await getLtcLeaveType();

  const startDate = parseDateInput(parsed.form.leaveFrom);
  const endDate = parseDateInput(parsed.form.leaveTo);
  if (!startDate || !endDate) {
    throw new Error("Invalid leave dates for LTC.");
  }
  if (endDate < startDate) {
    throw new Error(
      "Leave To date must be the same as or after Leave From date.",
    );
  }

  const computedDays = computeSessionLeaveDays(
    startDate,
    parsed.form.leaveFromSession,
    endDate,
    parsed.form.leaveToSession,
  );
  if (!computedDays) {
    throw new Error(
      "The selected date/session window is invalid. Please ensure To is after From.",
    );
  }

  const totalDays = Math.max(Math.ceil(computedDays), 1);

  const stepsToCreate: Prisma.ApprovalStepCreateWithoutLeaveApplicationInput[] =
    [];
  let workflowLabel = "";

  if (applicantRole === RoleKey.FACULTY) {
    // Faculty -> HoD (same department) -> Establishment -> Accounts -> Dean
    workflowLabel = "faculty-hod-establishment-accounts-dean";
    const controlling = await resolveLtcControllingApprover({
      departmentId: profile.departmentId,
      reportsTo: profile.reportsTo,
    });

    if (!controlling) {
      throw new Error(
        "Unable to route LTC. Please ensure your department (or reporting officer) HoD/Associate HoD is configured and active.",
      );
    }

    await Promise.all([
      ensureAnyActiveUserByRole(
        RoleKey.ESTABLISHMENT,
        "Unable to route LTC. Establishment account is missing or inactive.",
      ),
      ensureAnyActiveUserByRole(
        RoleKey.ACCOUNTS,
        "Unable to route LTC. Accounts account is missing or inactive.",
      ),
      ensureAnyActiveUserByRole(
        RoleKey.DEAN,
        "Unable to route LTC. Dean account is missing or inactive.",
      ),
    ]);

    stepsToCreate.push({
      sequence: 1,
      actor: toWorkflowActor(controlling.role),
      status: ApprovalStatus.PENDING,
      assignedTo: { connect: { id: controlling.id } },
      metadata: { workflowRule: controlling.rule },
    });

    stepsToCreate.push({
      sequence: 2,
      actor: WorkflowActor.ESTABLISHMENT,
      status: ApprovalStatus.PENDING,
      metadata: { workflowRule: "ltc-routing:faculty-establishment" },
    });

    stepsToCreate.push({
      sequence: 3,
      actor: WorkflowActor.ACCOUNTS,
      status: ApprovalStatus.PENDING,
      metadata: {
        workflowRule: "ltc-routing:faculty-accounts",
        balanceRequired: true,
      },
    });

    stepsToCreate.push({
      sequence: 4,
      actor: WorkflowActor.DEAN,
      status: ApprovalStatus.PENDING,
      metadata: { workflowRule: "ltc-routing:faculty-dean" },
    });
  } else if (applicantRole === RoleKey.STAFF) {
    // Staff -> HoD (same department) -> Establishment -> Accounts -> Dean
    workflowLabel = "staff-hod-establishment-accounts-dean";
    const controlling = await resolveLtcControllingApprover({
      departmentId: profile.departmentId,
      reportsTo: profile.reportsTo,
    });

    if (!controlling) {
      throw new Error(
        "Unable to route LTC. Please ensure your department (or reporting officer) HoD/Associate HoD is configured and active.",
      );
    }

    await Promise.all([
      ensureAnyActiveUserByRole(
        RoleKey.ESTABLISHMENT,
        "Unable to route LTC. Establishment account is missing or inactive.",
      ),
      ensureAnyActiveUserByRole(
        RoleKey.ACCOUNTS,
        "Unable to route LTC. Accounts account is missing or inactive.",
      ),
      ensureAnyActiveUserByRole(
        RoleKey.DEAN,
        "Unable to route LTC. Dean account is missing or inactive.",
      ),
    ]);

    stepsToCreate.push({
      sequence: 1,
      actor: toWorkflowActor(controlling.role),
      status: ApprovalStatus.PENDING,
      assignedTo: { connect: { id: controlling.id } },
      metadata: { workflowRule: controlling.rule },
    });

    stepsToCreate.push({
      sequence: 2,
      actor: WorkflowActor.ESTABLISHMENT,
      status: ApprovalStatus.PENDING,
      metadata: { workflowRule: "ltc-routing:staff-establishment" },
    });

    stepsToCreate.push({
      sequence: 3,
      actor: WorkflowActor.ACCOUNTS,
      status: ApprovalStatus.PENDING,
      metadata: {
        workflowRule: "ltc-routing:staff-accounts",
        balanceRequired: true,
      },
    });

    stepsToCreate.push({
      sequence: 4,
      actor: WorkflowActor.DEAN,
      status: ApprovalStatus.PENDING,
      metadata: { workflowRule: "ltc-routing:staff-dean" },
    });
  } else if (
    applicantRole === RoleKey.HOD ||
    applicantRole === RoleKey.ASSOCIATE_HOD
  ) {
    // HoD -> Establishment -> Accounts -> Dean
    workflowLabel = "hod-establishment-accounts-dean";

    await Promise.all([
      ensureAnyActiveUserByRole(
        RoleKey.DEAN,
        "Unable to route LTC for HoD. Dean account is missing or inactive.",
      ),
      ensureAnyActiveUserByRole(
        RoleKey.ESTABLISHMENT,
        "Unable to route LTC. Establishment account is missing or inactive.",
      ),
      ensureAnyActiveUserByRole(
        RoleKey.ACCOUNTS,
        "Unable to route LTC. Accounts account is missing or inactive.",
      ),
    ]);

    stepsToCreate.push({
      sequence: 1,
      actor: WorkflowActor.ESTABLISHMENT,
      status: ApprovalStatus.PENDING,
      metadata: { workflowRule: "ltc-routing:hod-establishment" },
    });

    stepsToCreate.push({
      sequence: 2,
      actor: WorkflowActor.ACCOUNTS,
      status: ApprovalStatus.PENDING,
      metadata: {
        workflowRule: "ltc-routing:hod-accounts",
        balanceRequired: true,
      },
    });

    stepsToCreate.push({
      sequence: 3,
      actor: WorkflowActor.DEAN,
      status: ApprovalStatus.PENDING,
      metadata: { workflowRule: "ltc-routing:hod-dean" },
    });
  } else {
    throw withStatus(
      `LTC routing is not configured for applicant role: ${applicantRole}.`,
      400,
    );
  }

  const signatureTimestamp = new Date().toISOString();
  const hasDigitalSignature = Boolean(parsed.signature && parsed.otpVerified);
  const signatureAnimationSerialized = hasDigitalSignature
    ? JSON.stringify(parsed.signature?.animation)
    : "";

  const placeToVisit = String(sanitizedForm.placeToVisit ?? "").trim();
  const purpose = placeToVisit ? `LTC: ${placeToVisit}` : "LTC";

  const application = await prisma.leaveApplication.create({
    data: {
      referenceCode: ltcReference(),
      applicantId: actor.userId,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      totalDays,
      status: LeaveStatus.UNDER_REVIEW,
      purpose,
      destination: placeToVisit || null,
      ltc: true,
      submittedAt: new Date(),
      metadata: {
        formData: {
          ...sanitizedForm,
          leaveDays: computedDays.toString(),
        },
        routing: {
          applicantRole,
          workflow: workflowLabel,
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

  await prisma.leaveApplication.update({
    where: { id: application.id },
    data: {
      metadata: {
        formData: {
          ...sanitizedForm,
          leaveDays: computedDays.toString(),
        },
        signatureProof,
        routing: {
          applicantRole,
          workflow: workflowLabel,
        },
      } as Prisma.InputJsonValue,
    },
  });

  try {
    const firstApprover = stepsToCreate[0];
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
        "Your LTC request has been submitted and routed for approval.",
      actionBy: firstApprover ? "Next approver" : undefined,
    });
  } catch {
    // ignore email failures
  }

  return {
    ok: true,
    message: "LTC application submitted successfully.",
    data: {
      id: application.id,
      applicationId: application.id,
      referenceCode: application.referenceCode,
      status: application.status,
    },
  };
};
