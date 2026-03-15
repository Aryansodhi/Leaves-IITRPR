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

const joiningReportPayloadSchema = z.object({
  form: z.object({
    name: z.string().trim().min(1),
    fromDate: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    toDate: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    totalDays: z.string().trim().regex(/^\d+$/),
    dutySession: z.enum(["Forenoon", "Afternoon"]),
    leaveCategory: z.enum([
      "Earned Leave",
      "Half Pay Leave",
      "Medical Leave",
      "Extra Ordinary Leave",
      "Vacation Leave",
    ]),
    rejoinDate: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    orderNo: z.string().trim().min(1),
    orderDate: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    englishRejoin: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    englishDays: z.string().trim().regex(/^\d+$/),
    englishFrom: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    englishTo: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    englishOrder: z.string().trim().min(1),
    englishOrderDate: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
    signature: z.string().trim().min(1),
    signName: z.string().trim().min(1),
    signDesignation: z.string().trim().min(1),
    signedDate: z
      .string()
      .trim()
      .refine((value) => parseDateInput(value) !== null),
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

const toIsoDateString = (value?: Date | null) => {
  if (!value) return "";
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const calculateInclusiveDays = (startDate: Date, endDate: Date) =>
  Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

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

const looksLikeDepartmentHod = (input: {
  name?: string | null;
  designation?: string | null;
}) => {
  const haystack = `${input.name ?? ""} ${input.designation ?? ""}`
    .trim()
    .toLowerCase();

  return haystack.includes("hod") || haystack.includes("head of department");
};

const toWorkflowActor = (role: RoleKey): WorkflowActor => {
  if (role === RoleKey.HOD) return WorkflowActor.HOD;
  if (role === RoleKey.ASSOCIATE_HOD) return WorkflowActor.ASSOCIATE_HOD;
  if (role === RoleKey.DEAN) return WorkflowActor.DEAN;
  return WorkflowActor.REGISTRAR;
};

const findFirstActiveUserByRole = async (role: RoleKey) => {
  const user = await prisma.user.findFirst({
    where: { isActive: true, role: { key: role } },
    include: { role: true },
  });

  if (!user || !user.role) {
    throw new Error(`${role} account not found for joining report routing.`);
  }

  return {
    id: user.id,
    name: user.name,
    roleKey: user.role.key,
  };
};

const getJoiningReportType = async () => {
  const leaveType = await prisma.leaveType.findUnique({
    where: { code: "JR" },
    select: { id: true, name: true, code: true },
  });

  if (!leaveType) {
    throw new Error("Joining Report type (code: JR) is not configured.");
  }

  return leaveType;
};

const joiningReportReference = () => {
  const year = new Date().getFullYear();
  return `JR-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

const resolveFacultyApprover = async (input: {
  departmentId: string | null;
  reportsToId: string | null;
}) => {
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
              { designation: { contains: "hod", mode: "insensitive" } },
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

  const approver =
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

  if (!approver) {
    throw new Error(
      "No HoD found for this faculty member's department. Please contact admin.",
    );
  }

  return {
    approverId: approver.id,
    approverName: approver.name,
    approverRole:
      approver.role?.key === RoleKey.ASSOCIATE_HOD
        ? RoleKey.ASSOCIATE_HOD
        : RoleKey.HOD,
  };
};

const resolveApproverForJoiningReport = async (input: {
  applicantRole: RoleKey;
  departmentId: string | null;
  reportsToId: string | null;
}) => {
  if (input.applicantRole === RoleKey.FACULTY) {
    return {
      ...(await resolveFacultyApprover({
        departmentId: input.departmentId,
        reportsToId: input.reportsToId,
      })),
      viewerOnly: false,
    };
  }

  if (input.applicantRole === RoleKey.STAFF) {
    const registrar = await findFirstActiveUserByRole(RoleKey.REGISTRAR);

    return {
      approverId: registrar.id,
      approverName: registrar.name,
      approverRole: registrar.roleKey,
      viewerOnly: false,
    };
  }

  if (input.applicantRole === RoleKey.HOD) {
    const dean = await findFirstActiveUserByRole(RoleKey.DEAN);

    return {
      approverId: dean.id,
      approverName: dean.name,
      approverRole: dean.roleKey,
      viewerOnly: false,
    };
  }

  throw new Error(
    "Joining report workflow is only configured for Faculty, Staff, and HoD applicants.",
  );
};

export const getJoiningReportBootstrap = async (actor: SessionActor) => {
  if (lockedApplicantRoles.has(actor.roleKey)) {
    throw withStatus(
      "Joining report form is locked for Dean and Registrar.",
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
    getJoiningReportType(),
  ]);

  if (!profile) {
    throw new Error("User profile not found.");
  }

  const history = await prisma.leaveApplication.findMany({
    where: {
      applicantId: actor.userId,
      leaveTypeId: leaveType.id,
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

  return {
    ok: true,
    data: {
      defaults: {
        name: profile.name ?? "",
        signName: profile.name ?? "",
        signDesignation: profile.designation ?? "",
        signature: profile.name ?? "",
        signedDate: toIsoDateString(new Date()),
        rejoinDate: toIsoDateString(new Date()),
        englishRejoin: toIsoDateString(new Date()),
        dutySession:
          typeof latestMetadata === "object" && latestMetadata
            ? String(
                (latestMetadata as Record<string, unknown>).dutySession ?? "",
              )
            : "",
        leaveCategory:
          typeof latestMetadata === "object" && latestMetadata
            ? String(
                (latestMetadata as Record<string, unknown>).leaveCategory ?? "",
              )
            : "",
        totalDays:
          typeof latestMetadata === "object" && latestMetadata
            ? String(
                (latestMetadata as Record<string, unknown>).totalDays ?? "",
              )
            : "",
        englishDays:
          typeof latestMetadata === "object" && latestMetadata
            ? String(
                (latestMetadata as Record<string, unknown>).englishDays ?? "",
              )
            : "",
      },
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

export const submitJoiningReport = async (
  payload: unknown,
  actor: SessionActor,
) => {
  if (lockedApplicantRoles.has(actor.roleKey)) {
    throw withStatus(
      "Joining report form is locked for Dean and Registrar.",
      403,
    );
  }

  const parsed = joiningReportPayloadSchema.parse(payload);

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

  const leaveType = await getJoiningReportType();
  const approver = await resolveApproverForJoiningReport({
    applicantRole: profile.role.key,
    departmentId: profile.departmentId,
    reportsToId: profile.reportsToId,
  });

  const startDate = parseDateInput(parsed.form.fromDate) ?? new Date();
  const endDate = parseDateInput(parsed.form.toDate) ?? startDate;
  if (endDate < startDate) {
    throw new Error(
      "The To date must be the same as or later than the From date.",
    );
  }

  const totalDays = Math.max(calculateInclusiveDays(startDate, endDate), 1);
  const decisionRequired = !approver.viewerOnly;
  const persistedForm = {
    ...parsed.form,
    totalDays: `${totalDays}`,
    englishDays: `${totalDays}`,
    englishFrom: parsed.form.fromDate,
    englishTo: parsed.form.toDate,
    englishRejoin: parsed.form.rejoinDate,
    englishOrderDate: parsed.form.orderDate,
  };

  const signatureTimestamp = new Date().toISOString();
  const signatureAnimationSerialized = JSON.stringify(
    parsed.signature.animation,
  );

  const application = await prisma.leaveApplication.create({
    data: {
      referenceCode: joiningReportReference(),
      applicantId: actor.userId,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      totalDays,
      status: decisionRequired
        ? LeaveStatus.UNDER_REVIEW
        : LeaveStatus.APPROVED,
      purpose: "Joining report after sanctioned leave",
      submittedAt: new Date(),
      approvedAt: decisionRequired ? null : new Date(),
      metadata: {
        formData: persistedForm,
        routing: {
          applicantRole: profile.role.key,
          approverRole: approver.approverRole,
          approverName: approver.approverName,
          viewerOnly: approver.viewerOnly,
        },
      } as Prisma.InputJsonValue,
      approvalSteps: {
        create: [
          {
            sequence: 1,
            actor: toWorkflowActor(approver.approverRole),
            status: ApprovalStatus.PENDING,
            assignedTo: {
              connect: { id: approver.approverId },
            },
            metadata: {
              workflowRule: "joining-report-routing-v1",
              leaveTypeCode: "JR",
              decisionRequired,
              viewerOnly: approver.viewerOnly,
            },
          },
        ],
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
        formData: persistedForm,
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
          approverRole: approver.approverRole,
          approverName: approver.approverName,
          viewerOnly: approver.viewerOnly,
        },
      } as Prisma.InputJsonValue,
    },
  });

  return {
    ok: true,
    message: approver.viewerOnly
      ? `Joining report forwarded to ${approver.approverName} (${approver.approverRole}) for viewing.`
      : `Joining report submitted to ${approver.approverName} (${approver.approverRole}) for approval.`,
    data: {
      id: application.id,
      referenceCode: application.referenceCode,
      status: application.status,
      approverName: approver.approverName,
      approverRole: approver.approverRole,
      viewerOnly: approver.viewerOnly,
      signatureTimestamp,
      signatureHash,
    },
  };
};
