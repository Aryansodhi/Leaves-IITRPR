import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RoleKey } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import {
  requireSessionActor,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";
import {
  resolveTaskAssignees,
  type WorkflowTaskRoutingInput,
} from "@/server/workflow/task-routing";

type TemplateWorkflowSchema = {
  tasks?: Array<WorkflowTaskRoutingInput & { id: string }>;
};

type CreatedTaskInstance = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const payload = await request.json();
    const templateId = String(payload?.templateId ?? "");
    const taskId = String(payload?.taskId ?? "");

    if (!templateId || !taskId) {
      console.error("Dispatch endpoint: missing required params", {
        templateId,
        taskId,
        payload,
      });
      return NextResponse.json(
        { ok: false, message: "templateId and taskId are required" },
        { status: 400 },
      );
    }

    const template = await prisma.formTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template)
      return NextResponse.json(
        { ok: false, message: "Form template not found" },
        { status: 404 },
      );

    const tasks = (template.schema as TemplateWorkflowSchema).tasks ?? [];
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task)
      return NextResponse.json(
        { ok: false, message: "Task not found on template" },
        { status: 404 },
      );

    const assigneeIds = await resolveTaskAssignees(task, {
      roleKey: actor.roleKey,
      departmentId: actor.departmentId,
    });

    const users = assigneeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    if (users.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No assignees found for this task" },
        { status: 400 },
      );
    }

    const created: CreatedTaskInstance[] = [];
    for (const u of users) {
      const record = await prisma.formTaskInstance.create({
        data: {
          templateId,
          taskId,
          assignedToId: u.id,
          status: "ASSIGNED",
        },
      });
      created.push({
        id: record.id,
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        status: record.status,
      });
    }

    await logAuditEvent({
      request,
      action: "ADMIN_DISPATCH_TASK",
      entityType: "FormTask",
      entityId: taskId,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent") ?? null,
      details: {
        createdCount: created.length,
        templateId,
        assignment: task.assignment ?? null,
      },
    });

    return NextResponse.json({ ok: true, data: { instances: created } });
  } catch (error) {
    console.error("Dispatch task failed", error);
    return NextResponse.json(
      { ok: false, message: "Unable to dispatch task" },
      { status: 500 },
    );
  }
}
