import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";
import { respondToActingHodForLeave } from "@/server/routes/leaves/acting-hod";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);
    const payload = await request.json();

    const result = await respondToActingHodForLeave(payload, {
      userId: actor.userId,
    });

    const applicationId =
      payload && typeof payload === "object" && "applicationId" in payload
        ? String((payload as { applicationId?: unknown }).applicationId ?? "")
        : "";

    await logAuditEvent({
      action: "ACTING_HOD_RESPOND",
      entityType: "LEAVE_APPLICATION",
      entityId: applicationId || null,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        ok: (result as { ok?: unknown } | null)?.ok ?? null,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof Error) {
      const status =
        "status" in error && typeof error.status === "number"
          ? error.status
          : 400;
      return NextResponse.json(
        { ok: false, message: error.message },
        { status },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Unable to respond to acting HoD request." },
      { status: 400 },
    );
  }
}
