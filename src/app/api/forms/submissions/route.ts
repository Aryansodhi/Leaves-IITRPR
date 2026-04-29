import { RoleKey } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";
import { prisma } from "@/server/db/prisma";
import { resolveTaskAssignees } from "@/server/workflow/task-routing";

const signaturePointSchema = z.object({
  x: z.number(),
  y: z.number(),
  time: z.number(),
});

const signatureStrokeSchema = z.object({
  points: z.array(signaturePointSchema),
  color: z.string().optional(),
});

const signatureCaptureSchema = z.object({
  animation: z.array(signatureStrokeSchema),
  image: z.string().min(1),
});

const submissionSchema = z.object({
  templateId: z.string().min(1),
  data: z.record(z.string(), z.string()).default({}),
  submissionId: z.string().min(1).optional(),
  action: z.enum(["SUBMIT", "COMPLETE_TASK"]).optional().default("SUBMIT"),
  signatureMode: z.enum(["digital", "upload", "typed"]).optional(),
  typedSignature: z.string().optional(),
  signature: signatureCaptureSchema.optional(),
  otpVerified: z.boolean().optional().default(false),
  approverSignature: z.string().optional(),
});

type WorkflowTask = {
  id: string;
  title: string;
  type: "fillform" | "signature";
  formTemplateId?: string | null;
  assignment: {
    mode: "specific" | "role" | "department" | "sameDepartmentRole" | "all";
    values: string[];
  };
  routes?: Array<{
    id: string;
    sourceRoles: RoleKey[];
    assignment: WorkflowTask["assignment"];
  }>;
};

type WorkflowRuntimeTask = WorkflowTask & {
  sequence: number;
  status: "PENDING" | "IN_PROGRESS" | "DONE";
  assigneeIds: string[];
  completedById?: string | null;
  completedAt?: string | null;
};

type WorkflowState = {
  status: "PENDING" | "APPROVED";
  currentTaskIndex: number | null;
  tasks: WorkflowRuntimeTask[];
  context?: {
    submittedByRoleKey: RoleKey;
    submittedByDepartmentId: string | null;
  };
};

type SubmissionPayload = {
  values?: Record<string, string>;
  workflow?: WorkflowState;
};

type WorkflowSubmissionItem = {
  id: string;
  createdAt: string;
  status: "PENDING" | "APPROVED";
  currentTaskIndex: number | null;
  currentTaskTitle: string | null;
  currentTaskType: "fillform" | "signature" | null;
  canAct: boolean;
  submittedBy?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

const parseSubmissionData = (value: unknown): SubmissionPayload => {
  if (!value || typeof value !== "object") return {};
  return value as SubmissionPayload;
};

const toWorkflowItem = (
  submissionId: string,
  createdAt: Date,
  data: SubmissionPayload,
  submittedBy: { name: string | null; email: string | null } | null,
  actorUserId: string,
): WorkflowSubmissionItem | null => {
  const workflow = data.workflow;
  if (!workflow) return null;

  const currentTask =
    workflow.currentTaskIndex != null
      ? (workflow.tasks[workflow.currentTaskIndex] ?? null)
      : null;

  return {
    id: submissionId,
    createdAt: createdAt.toISOString(),
    status: workflow.status,
    currentTaskIndex: workflow.currentTaskIndex,
    currentTaskTitle: currentTask?.title ?? null,
    currentTaskType: currentTask?.type ?? null,
    canAct: Boolean(currentTask?.assigneeIds.includes(actorUserId)),
    submittedBy,
  };
};

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);

    const url = new URL(request.url);
    const templateId = url.searchParams.get("templateId");
    if (!templateId) {
      return NextResponse.json(
        { ok: false, message: "Template id is required." },
        { status: 400 },
      );
    }

    const template = await prisma.formTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, schema: true },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, message: "Form template not found." },
        { status: 404 },
      );
    }

    const schema = template.schema as unknown as {
      visibilityRoles?: string[];
      lifecycle?: {
        status?: "draft" | "published";
      };
    };

    if (schema?.lifecycle?.status === "draft") {
      return NextResponse.json(
        { ok: false, message: "This form is not published yet." },
        { status: 400 },
      );
    }

    if (
      schema?.visibilityRoles?.length &&
      !schema.visibilityRoles.includes(actor.roleKey)
    ) {
      return NextResponse.json(
        { ok: false, message: "You do not have access to this form." },
        { status: 403 },
      );
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { templateId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        submittedBy: { select: { name: true, email: true } },
        data: true,
      },
    });

    const items = submissions
      .map((entry) =>
        toWorkflowItem(
          entry.id,
          entry.createdAt,
          parseSubmissionData(entry.data),
          entry.submittedBy,
          actor.userId,
        ),
      )
      .filter((entry): entry is WorkflowSubmissionItem => Boolean(entry));

    const pendingForActor = items.find((item) => item.canAct) ?? null;

    return NextResponse.json({
      ok: true,
      data: {
        items,
        pendingForActor,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    console.error("Failed to load form submissions", error);
    return NextResponse.json(
      { ok: false, message: "Unable to load form submissions." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);

    const payload = await request.json();
    const parsed = submissionSchema.parse(payload);

    const template = await prisma.formTemplate.findUnique({
      where: { id: parsed.templateId },
      select: { id: true, schema: true },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, message: "Form template not found." },
        { status: 404 },
      );
    }

    const schema = template.schema as unknown as {
      visibilityRoles?: string[];
      lifecycle?: {
        status?: "draft" | "published";
      };
      tasks?: WorkflowTask[];
      pages?: Array<{
        fields?: Array<{ kind?: string }>;
      }>;
    };

    const hasSignatureField = Boolean(
      schema.pages?.some((page) =>
        page.fields?.some((field) => field.kind === "signature"),
      ),
    );

    if (schema?.lifecycle?.status === "draft") {
      return NextResponse.json(
        { ok: false, message: "This form is not published yet." },
        { status: 400 },
      );
    }

    if (
      schema?.visibilityRoles?.length &&
      !schema.visibilityRoles.includes(actor.roleKey)
    ) {
      return NextResponse.json(
        { ok: false, message: "You do not have access to this form." },
        { status: 403 },
      );
    }

    if (parsed.action === "SUBMIT" && hasSignatureField) {
      if (parsed.signatureMode === "typed") {
        if (
          !parsed.typedSignature ||
          parsed.typedSignature.trim().length === 0
        ) {
          return NextResponse.json(
            { ok: false, message: "Typed signature is required." },
            { status: 400 },
          );
        }
      } else {
        if (!parsed.signature) {
          return NextResponse.json(
            { ok: false, message: "Digital signature image is required." },
            { status: 400 },
          );
        }

        if (!parsed.otpVerified) {
          return NextResponse.json(
            {
              ok: false,
              message: "OTP verification is required for digital signature.",
            },
            { status: 400 },
          );
        }
      }
    }

    const workflowTasks = Array.isArray(schema.tasks)
      ? [...schema.tasks]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((task, index) => ({ ...task, order: index }))
      : [];
    const payloadValues = parsed.data;

    let submissionId: string;

    if (workflowTasks.length === 0) {
      const submission = await prisma.formSubmission.create({
        data: {
          templateId: parsed.templateId,
          submittedById: actor.userId,
          data: payloadValues,
        },
      });
      submissionId = submission.id;
    } else if (parsed.action === "SUBMIT" && !parsed.submissionId) {
      const runtimeTasks: WorkflowRuntimeTask[] = await Promise.all(
        workflowTasks.map(async (task, index) => {
          const assigneeIds = await resolveTaskAssignees(task, {
            roleKey: actor.roleKey,
            departmentId: actor.departmentId,
          });
          return {
            ...task,
            sequence: index + 1,
            status: "PENDING",
            assigneeIds,
            completedById: null,
            completedAt: null,
          };
        }),
      );

      const firstTask = runtimeTasks[0];
      if (!firstTask || firstTask.assigneeIds.length === 0) {
        throw new Error("The first workflow task has no assignees.");
      }

      firstTask.status = "IN_PROGRESS";

      const submission = await prisma.formSubmission.create({
        data: {
          templateId: parsed.templateId,
          submittedById: actor.userId,
          data: {
            values: payloadValues,
            workflow: {
              status: "PENDING",
              currentTaskIndex: 0,
              tasks: runtimeTasks,
              context: {
                submittedByRoleKey: actor.roleKey,
                submittedByDepartmentId: actor.departmentId ?? null,
              },
            },
          },
          taskOrderSnapshot: workflowTasks,
          currentWorkflowStepIndex: 0,
        },
      });

      submissionId = submission.id;
    } else {
      if (!parsed.submissionId) {
        throw new Error("Submission id is required to complete a task.");
      }

      const existing = await prisma.formSubmission.findUnique({
        where: { id: parsed.submissionId },
        select: {
          id: true,
          templateId: true,
          data: true,
        },
      });

      if (!existing || existing.templateId !== parsed.templateId) {
        throw new Error("Workflow submission not found.");
      }

      const existingData = parseSubmissionData(existing.data);
      const workflow = existingData.workflow;
      if (!workflow) {
        throw new Error("This submission is not workflow-enabled.");
      }

      if (workflow.status === "APPROVED") {
        throw new Error("This workflow is already approved.");
      }

      if (workflow.currentTaskIndex == null) {
        throw new Error("No pending task found for this workflow.");
      }

      const currentTask = workflow.tasks[workflow.currentTaskIndex];
      if (!currentTask) {
        throw new Error("Current task not found.");
      }

      if (!currentTask.assigneeIds.includes(actor.userId)) {
        throw new Error("You are not assigned to this pending task.");
      }

      if (currentTask.type === "signature") {
        if (parsed.signatureMode === "typed") {
          if (
            !parsed.typedSignature ||
            parsed.typedSignature.trim().length === 0
          ) {
            return NextResponse.json(
              { ok: false, message: "Typed signature is required." },
              { status: 400 },
            );
          }
        } else {
          if (!parsed.signature) {
            return NextResponse.json(
              { ok: false, message: "Digital signature image is required." },
              { status: 400 },
            );
          }

          if (!parsed.otpVerified) {
            return NextResponse.json(
              {
                ok: false,
                message: "OTP verification is required for digital signature.",
              },
              { status: 400 },
            );
          }
        }
      }

      const updatedTasks = [...workflow.tasks];
      updatedTasks[workflow.currentTaskIndex] = {
        ...currentTask,
        status: "DONE",
        completedById: actor.userId,
        completedAt: new Date().toISOString(),
      };

      let nextTaskIndex: number | null = null;
      for (
        let index = workflow.currentTaskIndex + 1;
        index < updatedTasks.length;
        index += 1
      ) {
        if (updatedTasks[index].status !== "DONE") {
          nextTaskIndex = index;
          break;
        }
      }

      if (nextTaskIndex != null) {
        updatedTasks[nextTaskIndex] = {
          ...updatedTasks[nextTaskIndex],
          status: "IN_PROGRESS",
        };
      }

      const nextWorkflow: WorkflowState = {
        status: nextTaskIndex == null ? "APPROVED" : "PENDING",
        currentTaskIndex: nextTaskIndex,
        tasks: updatedTasks,
      };

      // Create audit log entry for step completion
      await prisma.formSubmissionStepAction.create({
        data: {
          submissionId: existing.id,
          stepIndex: workflow.currentTaskIndex,
          taskId: currentTask.id,
          action: "COMPLETED",
          completedByUserId: actor.userId,
          remarks: null,
          metadata:
            currentTask.type === "signature"
              ? {
                  approverSignature:
                    parsed.approverSignature ??
                    (parsed.signatureMode === "typed"
                      ? (parsed.typedSignature?.trim() ?? null)
                      : "DIGITAL_SIGNATURE_VALUE"),
                  signatureMode: parsed.signatureMode ?? null,
                  typedSignature:
                    parsed.signatureMode === "typed"
                      ? (parsed.typedSignature?.trim() ?? null)
                      : null,
                  otpVerified:
                    parsed.signatureMode === "typed"
                      ? false
                      : parsed.otpVerified,
                }
              : undefined,
        },
      });

      await prisma.formSubmission.update({
        where: { id: existing.id },
        data: {
          data: {
            ...existingData,
            values: {
              ...(existingData.values ?? {}),
              ...payloadValues,
            },
            workflow: nextWorkflow,
          },
          currentWorkflowStepIndex: nextTaskIndex ?? updatedTasks.length,
        },
      });

      submissionId = existing.id;
    }

    await logAuditEvent({
      request,
      action:
        workflowTasks.length === 0
          ? "SUBMIT_FORM_TEMPLATE"
          : parsed.action === "COMPLETE_TASK"
            ? "COMPLETE_FORM_TASK"
            : "SUBMIT_FORM_TEMPLATE",
      entityType: "FORM_SUBMISSION",
      entityId: submissionId,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        templateId: parsed.templateId,
        action: parsed.action,
      },
    });

    const message =
      workflowTasks.length === 0
        ? "Form submitted successfully."
        : parsed.action === "COMPLETE_TASK"
          ? "Task completed and workflow moved to the next step."
          : "Form submitted successfully and forwarded to approvers.";

    return NextResponse.json(
      { ok: true, message, data: { id: submissionId } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, message: "Invalid submission payload." },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    console.error("Form submission failed", error);
    return NextResponse.json(
      { ok: false, message: "Unable to submit the form." },
      { status: 500 },
    );
  }
}
