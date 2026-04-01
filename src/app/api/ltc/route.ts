import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";
import { submitLtc } from "@/server/routes/leaves/ltc";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);

    const payload = await request.json();
    const result = await submitLtc(payload, {
      userId: actor.userId,
      roleKey: actor.roleKey,
    });

    if (result?.ok && result.data?.id) {
      const ipAddress = getRequestIp(request);
      const userAgent = request.headers.get("user-agent");
      await logAuditEvent({
        action: "SUBMIT_LTC",
        entityType: "LEAVE_APPLICATION",
        entityId: result.data.id,
        referenceCode: result.data.referenceCode ?? null,
        userId: actor.userId,
        userEmail: actor.email,
        userName: actor.name,
        ipAddress,
        userAgent,
        details: {
          status: result.data.status,
          leaveType: "LTC",
        },
      });
    }

    return NextResponse.json(result, { status: 201 });
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
      { ok: false, message: "Unable to submit LTC request." },
      { status: 400 },
    );
  }
}
