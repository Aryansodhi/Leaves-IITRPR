import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RoleKey } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import {
  requireSessionActor,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const { instanceId } = await params;
    if (!instanceId)
      return NextResponse.json(
        { ok: false, message: "instanceId required" },
        { status: 400 },
      );

    const instance = await prisma.formTaskInstance.findUnique({
      where: { id: instanceId },
    });
    if (!instance)
      return NextResponse.json(
        { ok: false, message: "Instance not found" },
        { status: 404 },
      );

    if (instance.status === "DONE") {
      return NextResponse.json(
        { ok: false, message: "Instance already done" },
        { status: 400 },
      );
    }

    const updated = await prisma.formTaskInstance.update({
      where: { id: instanceId },
      data: { status: "DONE", actedAt: new Date() },
    });

    await logAuditEvent({
      request,
      action: "ADMIN_MARK_TASK_INSTANCE_DONE",
      entityType: "FormTaskInstance",
      entityId: instanceId,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent") ?? null,
      details: {
        templateId: updated.templateId,
        taskId: updated.taskId,
        assignedToId: updated.assignedToId,
      },
    });

    return NextResponse.json({ ok: true, data: { id: updated.id } });
  } catch (error) {
    console.error("Complete instance failed", error);
    return NextResponse.json(
      { ok: false, message: "Unable to complete instance" },
      { status: 500 },
    );
  }
}
