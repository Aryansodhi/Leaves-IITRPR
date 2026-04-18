import { RoleKey } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { createFormTemplateHandler } from "@/server/routes/admin/form-templates";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const payload = await request.json();
    const result = await createFormTemplateHandler(payload, actor.userId);

    const name =
      payload && typeof payload === "object" && "name" in payload
        ? String((payload as { name?: unknown }).name ?? "")
        : "";

    await logAuditEvent({
      action: "ADMIN_CREATE_FORM_TEMPLATE",
      entityType: "FORM_TEMPLATE",
      entityId: result.body.data?.id ?? null,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        ok: result.body.ok ?? null,
        name: name || null,
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("Invalid admin form payload", error);
    return NextResponse.json(
      { ok: false, message: "Unable to read the request body." },
      { status: 400 },
    );
  }
}
