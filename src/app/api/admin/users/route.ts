import { RoleKey } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { createUserHandler } from "@/server/routes/admin/users";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const payload = await request.json();
    const result = await createUserHandler(payload);

    const email =
      payload && typeof payload === "object" && "user" in payload
        ? String(
            ((payload as { user?: unknown }).user as { email?: unknown } | null)
              ?.email ?? "",
          )
        : "";

    await logAuditEvent({
      action: "ADMIN_CREATE_USER",
      entityType: "USER",
      entityId: null,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        ok: result.body?.ok ?? null,
        targetEmail: email || null,
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

    console.error("Invalid admin create payload", error);
    return NextResponse.json(
      { ok: false, message: "Unable to read the request body." },
      { status: 400 },
    );
  }
}
