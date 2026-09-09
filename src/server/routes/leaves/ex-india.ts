import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ApprovalStatus,
  LeaveStatus,
  Prisma,
  WorkflowActor,
} from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { sendLeaveSubmissionEmail } from "@/server/email/mailer";

const exIndiaPayload = z.object({
  form: z.record(z.string(), z.string().optional()),
  signature: z
    .object({
      animation: z.array(z.unknown()).optional(),
      image: z.string().trim().optional(),
    })
    .optional(),
  otpVerified: z.boolean().optional().default(false),
});

const exIndiaReference = () =>
  `EXI-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

const toWorkflowActor = (value: string | null | undefined) => {
  if (!value) return WorkflowActor.HOD;

  return value in WorkflowActor
    ? WorkflowActor[value as keyof typeof WorkflowActor]
    : WorkflowActor.HOD;
};

export const submitExIndia = async (
  payload: unknown,
  actor: { userId: string; roleKey?: string },
) => {
  const parsed = exIndiaPayload.parse(payload);

  const applicant = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { role: true, department: true },
  });
  if (!applicant) throw new Error("Unable to resolve applicant profile.");

  // expect witness ids in form: witness1Id, witness2Id
  const witness1 = (parsed.form.witness1Id || "").trim();
  const witness2 = (parsed.form.witness2Id || "").trim();
  if (!witness1 && !witness2) {
    throw new Error("Please select a witness before sending the request.");
  }
  if (witness1 === actor.userId || witness2 === actor.userId) {
    throw new Error("Witnesses cannot be the applicant.");
  }
  if (witness1 && witness2 && witness1 === witness2) {
    throw new Error("Please select two different witnesses.");
  }

  const selectedWitnessIds = [witness1, witness2].filter(Boolean);
  const witnessUsers = await prisma.user.findMany({
    where: { id: { in: selectedWitnessIds }, isActive: true },
  });
  if (witnessUsers.length !== selectedWitnessIds.length)
    throw new Error("One or more selected witnesses are not valid.");

  // determine controlling approver similar to other leave flows (HOD/Registrar/Dean)
  // fallback: use user's reportsTo or department HOD
  let approverId: string | null = null;
  let approverRole: string | null = null;

  if (applicant.reportsToId && applicant.reportsToId !== null) {
    const rep = await prisma.user.findUnique({
      where: { id: applicant.reportsToId },
      include: { role: true },
    });
    if (rep && rep.role) {
      approverId = rep.id;
      approverRole = rep.role.key;
    }
  }

  if (!approverId) {
    const hod = await prisma.user.findFirst({
      where: {
        departmentId: applicant.departmentId,
        role: { key: "HOD" },
        isActive: true,
      },
      include: { role: true },
    });
    if (hod && hod.role) {
      approverId = hod.id;
      approverRole = hod.role.key;
    }
  }

  if (!approverId) {
    // fallback to registrar
    const registrar = await prisma.user.findFirst({
      where: { role: { key: "REGISTRAR" }, isActive: true },
      include: { role: true },
    });
    if (registrar && registrar.role) {
      approverId = registrar.id;
      approverRole = registrar.role.key;
    }
  }

  if (!approverId)
    throw new Error(
      "Unable to resolve controlling officer for your application.",
    );

  // create approval steps: witnesses -> controlling officer -> accounts -> sanctioner (dean/registrar) -> director(optional)
  const accountUser = await prisma.user.findFirst({
    where: { isActive: true, role: { key: "ACCOUNTS" } },
  });
  const deanUser = await prisma.user.findFirst({
    where: { isActive: true, role: { key: "DEAN" } },
    include: { role: true },
  });
  const registrarUser = await prisma.user.findFirst({
    where: { isActive: true, role: { key: "REGISTRAR" } },
    include: { role: true },
  });
  const directorUser = await prisma.user.findFirst({
    where: { isActive: true, role: { key: "DIRECTOR" } },
  });

  const sanctioner =
    applicant.roleId && applicant.roleId === undefined
      ? registrarUser
      : deanUser; // simple fallback

  const stepsToCreate: Prisma.ApprovalStepCreateWithoutLeaveApplicationInput[] =
    [];

  // witness steps
  stepsToCreate.push({
    sequence: 1,
    actor: WorkflowActor.APPLICANT,
    status: ApprovalStatus.PENDING,
    ...(witness1 ? { assignedTo: { connect: { id: witness1 } } } : {}),
    metadata: { role: "witness" },
  });
  stepsToCreate.push({
    sequence: 2,
    actor: WorkflowActor.APPLICANT,
    status: ApprovalStatus.PENDING,
    ...(witness2 ? { assignedTo: { connect: { id: witness2 } } } : {}),
    metadata: { role: "witness" },
  });

  // controlling officer
  stepsToCreate.push({
    sequence: 3,
    actor: toWorkflowActor(approverRole),
    status: ApprovalStatus.PENDING,
    assignedTo: { connect: { id: approverId } },
    metadata: { workflowRule: "ex-india-routing-ca" },
  });

  if (accountUser) {
    stepsToCreate.push({
      sequence: stepsToCreate.length + 1,
      actor: WorkflowActor.ACCOUNTS,
      status: ApprovalStatus.PENDING,
      assignedTo: { connect: { id: accountUser.id } },
      metadata: { workflowRule: "ex-india-routing-accounts" },
    });
  }

  if (sanctioner && sanctioner.id) {
    stepsToCreate.push({
      sequence: stepsToCreate.length + 1,
      actor: toWorkflowActor(sanctioner.role?.key),
      status: ApprovalStatus.PENDING,
      assignedTo: { connect: { id: sanctioner.id } },
      metadata: { workflowRule: "ex-india-routing-sanction" },
    });
  }

  // optional director
  if (directorUser) {
    stepsToCreate.push({
      sequence: stepsToCreate.length + 1,
      actor: WorkflowActor.DIRECTOR,
      status: ApprovalStatus.PENDING,
      assignedTo: { connect: { id: directorUser.id } },
      metadata: { workflowRule: "ex-india-routing-director" },
    });
  }

  const reference = exIndiaReference();

  const now = new Date();
  const reminderAt = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour later
  const parsedDays = parsed.form.days
    ? Number.parseFloat(parsed.form.days)
    : Number.NaN;
  const leaveType = await prisma.leaveType.findFirst({
    where: {
      OR: [
        { code: "EXI" },
        { name: { contains: "Ex-India", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (!leaveType) {
    throw new Error("Ex-India leave type is not configured.");
  }

  const application = await prisma.leaveApplication.create({
    data: {
      referenceCode: reference,
      applicant: { connect: { id: actor.userId } },
      leaveType: { connect: { id: leaveType.id } },
      startDate: parsed.form.fromDate
        ? new Date(parsed.form.fromDate)
        : new Date(),
      endDate: parsed.form.toDate ? new Date(parsed.form.toDate) : new Date(),
      totalDays: Number.isFinite(parsedDays) ? Math.ceil(parsedDays) : 0,
      status: LeaveStatus.SUBMITTED,
      purpose: parsed.form.purpose ?? "",
      destination: parsed.form.country ?? null,
      exIndia: true,
      stationLeave: false,
      contactDuringLeave: parsed.form.contactNo ?? null,
      submittedAt: now,
      metadata: {
        formData: parsed.form,
        witnesses: selectedWitnessIds,
        witnessRequests: [
          ...(witness1
            ? [
                {
                  sequence: 1,
                  witnessId: witness1,
                  requestedAt: now.toISOString(),
                  reminderAt: reminderAt.toISOString(),
                },
              ]
            : []),
          ...(witness2
            ? [
                {
                  sequence: 2,
                  witnessId: witness2,
                  requestedAt: now.toISOString(),
                  reminderAt: reminderAt.toISOString(),
                },
              ]
            : []),
        ],
      } as Prisma.InputJsonValue,
      approvalSteps: { create: stepsToCreate },
    },
  });

  // notify witnesses (best-effort)
  try {
    for (const w of witnessUsers) {
      await sendLeaveSubmissionEmail({
        to: w.email,
        applicantName: applicant.name,
        referenceCode: application.referenceCode,
        leaveType: "Ex-India",
        status: application.status,
        startDate: application.startDate,
        endDate: application.endDate,
        totalDays: application.totalDays,
        actionLabel:
          "You have been requested to endorse as a witness for an Ex-India leave application.",
        actionBy: applicant.name,
      });
    }

    // persist requestedAt/reminderAt metadata on witness approval steps
    const witnessSteps = await prisma.approvalStep.findMany({
      where: {
        leaveApplicationId: application.id,
        metadata: { path: ["role"], equals: "witness" },
      },
    });
    for (const step of witnessSteps) {
      await prisma.approvalStep.update({
        where: { id: step.id },
        data: {
          metadata: {
            ...(step.metadata as Prisma.JsonObject | null),
            requestedAt: now.toISOString(),
            reminderAt: reminderAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }
  } catch (err) {
    console.error("Failed to notify witnesses", err);
  }

  return {
    ok: true,
    data: { id: application.id, referenceCode: application.referenceCode },
  };
};

export const decideExIndiaApproval = async () => {
  // For approval decisions, reuse the generic decideLeaveApproval in approvals.ts via API route.
  // This shim exists for parity with other leave types; actual decision handling will be routed to the generic approval handler.
  return { ok: true, message: "Use generic approval endpoint." };
};
