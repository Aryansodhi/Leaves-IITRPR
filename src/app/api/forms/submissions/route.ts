import { z } from "zod";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";

const submissionSchema = z.object({
  templateId: z.string().min(1),
  data: z.record(z.string(), z.string()).default({}),
  submissionId: z.string().min(1).optional(),
  action: z.enum(["SUBMIT", "COMPLETE_TASK"]).optional().default("SUBMIT"),
});

type WorkflowTask = {
  id: string;
  title: string;
  type: "fillform" | "signature";
  formTemplateId?: string | null;
  assignment: {
    mode: "specific" | "role" | "department" | "all";
    values: string[];
  };
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
};

type SubmissionDataPayload = {
  values?: Record<string, string>;
  workflow?: WorkflowState;
};

const resolveAssignmentUserIds = async (task: WorkflowTask) => {
  if (task.assignment.mode === "all") {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  if (task.assignment.mode === "role") {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          key: {
            in: task.assignment.values as Array<
              | "FACULTY"
              | "STAFF"
              | "HOD"
              | "ASSOCIATE_HOD"
              | "DEAN"
              | "REGISTRAR"
              | "DIRECTOR"
              | "ACCOUNTS"
              | "ESTABLISHMENT"
              | "ADMIN"
            >,
          },
        },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  if (task.assignment.mode === "department") {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        departmentId: { in: task.assignment.values },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { id: { in: task.assignment.values } },
        { email: { in: task.assignment.values } },
      ],
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
};

const parseSubmissionData = (value: unknown): SubmissionDataPayload => {
  if (!value || typeof value !== "object") return {};
  return value as SubmissionDataPayload;
};

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);

    const url = new URL(request.url);
    const templateId = url.searchParams.get("templateId")?.trim();

    if (!templateId) {
      return NextResponse.json(
        { ok: false, message: "Template id is required." },
        { status: 400 },
      );
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { templateId },
      select: {
        id: true,
        createdAt: true,
        submittedById: true,
        submittedBy: { select: { name: true, email: true } },
        data: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    });

    const items = submissions
      .map((entry) => {
        const payload = parseSubmissionData(entry.data);
        const workflow = payload.workflow;
        if (!workflow) return null;
        const currentTask =
          workflow.currentTaskIndex != null
            ? workflow.tasks[workflow.currentTaskIndex]
            : null;
        const canAct = Boolean(currentTask?.assigneeIds.includes(actor.userId));
        const isParticipant = workflow.tasks.some(
          (task) =>
            task.assigneeIds.includes(actor.userId) ||
            task.completedById === actor.userId,
        );
        const visible = isParticipant || entry.submittedById === actor.userId;
        if (!visible) return null;
        return {
          id: entry.id,
          createdAt: entry.createdAt,
          status: workflow.status,
          currentTaskIndex: workflow.currentTaskIndex,
          currentTaskTitle: currentTask?.title ?? null,
          currentTaskType: currentTask?.type ?? null,
          canAct,
          submittedBy: entry.submittedBy,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const pendingForActor =
      items.find((item) => item.canAct && item.status === "PENDING") ?? null;

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

    return NextResponse.json(
      { ok: false, message: "Unable to load workflow submissions." },
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

    const workflowTasks = Array.isArray(schema.tasks) ? schema.tasks : [];

    const submission = await (async () => {
      if (workflowTasks.length === 0) {
        return prisma.formSubmission.create({
          data: {
            templateId: parsed.templateId,
            submittedById: actor.userId,
            data: parsed.data,
          },
        });
      }

      if (parsed.action === "SUBMIT" && !parsed.submissionId) {
        const runtimeTasks: WorkflowRuntimeTask[] = await Promise.all(
          workflowTasks.map(async (task, index) => {
            const assigneeIds = await resolveAssignmentUserIds(task);
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

        return prisma.formSubmission.create({
          data: {
            templateId: parsed.templateId,
            submittedById: actor.userId,
            data: {
              values: parsed.data,
              workflow: {
                status: "PENDING",
                currentTaskIndex: 0,
                tasks: runtimeTasks,
              },
            },
          },
        });
      }

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

      await prisma.formSubmission.update({
        where: { id: existing.id },
        data: {
          data: {
            ...existingData,
            values: {
              ...(existingData.values ?? {}),
              ...parsed.data,
            },
            workflow: nextWorkflow,
          },
        },
      });

      return {
        id: existing.id,
      };
    })();

    await logAuditEvent({
      action: "SUBMIT_FORM_TEMPLATE",
      entityType: "FORM_SUBMISSION",
      entityId: submission.id,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        templateId: parsed.templateId,
      },
    });

    const message =
      parsed.action === "COMPLETE_TASK"
        ? "Task completed and workflow moved to the next step."
        : "Form submitted successfully and forwarded to approvers.";

    return NextResponse.json(
      { ok: true, message, data: { id: submission.id } },
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
