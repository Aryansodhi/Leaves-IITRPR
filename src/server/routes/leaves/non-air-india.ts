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

const nonAirIndiaPayloadSchema = z.object({
  form: z.object({
    name: z.string().trim().min(1),
    designation: z.string().trim().min(1),
    department: z.string().trim().min(1),
    onwardJourney: z.string().trim().min(1),
    returnJourney: z.string().trim().min(1),
    placeToVisit: z.string().trim().min(1),
    purpose: z.string().trim().min(1),
    sectors: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    permissionMhrd: z.string().trim().min(1),
    budgetHead: z.string().trim().min(1),
    applicantSignature: z.string().trim().min(1),
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
  return null;
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
      return WorkflowActor.HOD; // Default fallback
  }
};

const nonAirIndiaReference = () => {
  const year = new Date().getFullYear();
  return `AIR-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

const getNonAirIndiaLeaveType = async () => {
  const leaveType = await prisma.leaveType.findUnique({
    where: { code: "AIR" },
    select: { id: true, name: true },
  });

  if (!leaveType) {
    throw new Error(
      "Non-Air India Leave type (code: AIR) is not configured in DB.",
    );
  }

  return leaveType;
};

export const submitNonAirIndia = async (
  payload: unknown,
  actor: SessionActor,
) => {
  const parsed = nonAirIndiaPayloadSchema.parse(payload);

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

  const applicantRole = profile.role?.key ?? actor.roleKey;

  // STRICT ROUTING: Fetch the assigned manager directly from the database
  if (!profile.reportsToId || !profile.reportsTo) {
    throw new Error(
      "No reporting manager assigned to your account. Please contact admin.",
    );
  }

  if (!profile.reportsTo.isActive || !profile.reportsTo.role) {
    throw new Error(
      "Your assigned reporting manager is inactive or missing a valid role.",
    );
  }

  const approverId = profile.reportsTo.id;
  const approverName = profile.reportsTo.name;
  const approverRole = profile.reportsTo.role.key;

  const leaveType = await getNonAirIndiaLeaveType();
  const startDate = parseDateInput(parsed.form.onwardJourney) ?? new Date();
  const endDate = parseDateInput(parsed.form.returnJourney) ?? startDate;

  // Calculate approximate days between dates
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const totalDays = Math.max(
    Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1,
    1,
  );

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
          workflowRule: "non-air-india-routing",
        },
      },
    ];

  const signatureTimestamp = new Date().toISOString();
  const signatureAnimationSerialized = JSON.stringify(
    parsed.signature.animation,
  );

  const application = await prisma.leaveApplication.create({
    data: {
      referenceCode: nonAirIndiaReference(),
      applicantId: actor.userId,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      totalDays,
      status: LeaveStatus.UNDER_REVIEW,
      purpose: parsed.form.purpose,
      destination: parsed.form.placeToVisit,
      submittedAt: new Date(),
      metadata: {
        formData: parsed.form,
        signatureProof: {
          animation: parsed.signature.animation,
          image: parsed.signature.image,
          timestamp: signatureTimestamp,
          hash: "",
          otpVerified: true,
        },
        routing: {
          applicantRole,
          approverRole: approverRole,
          approverName: approverName,
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
        formData: parsed.form,
        signatureProof: {
          formId: application.id,
          animation: parsed.signature.animation,
          image: parsed.signature.image,
          timestamp: signatureTimestamp,
          hash: signatureHash,
          otpVerified: true,
        },
        routing: {
          applicantRole,
          approverRole: approverRole,
          approverName: approverName,
        },
      } as Prisma.InputJsonValue,
    },
  });

  return {
    ok: true,
    message: `Request submitted to ${approverName} (${approverRole}).`,
    data: {
      id: application.id,
      referenceCode: application.referenceCode,
      status: application.status,
      approverName: approverName,
      approverRole: approverRole,
      signatureTimestamp,
      signatureHash,
    },
  };
};
