import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSessionCookieConfig,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
import { verifyOtpHandler } from "@/server/routes/auth/verify-otp";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await verifyOtpHandler(payload);

    if (result.sessionToken) {
      const cookieStore = await cookies();
      cookieStore.set({
        name: SESSION_COOKIE_NAME,
        value: result.sessionToken,
        ...getSessionCookieConfig(request),
      });
    }

    const ipAddress = getRequestIp(request);
    const userAgent = request.headers.get("user-agent");
    const payloadEmail =
      payload && typeof payload === "object" && "email" in payload
        ? String((payload as { email?: unknown }).email ?? "")
        : "";
    const ok = Boolean(result.body?.ok);
    const user = ok && "user" in result.body ? result.body.user : null;

    await logAuditEvent({
      action: ok ? "AUTH_VERIFY_OTP_SUCCESS" : "AUTH_VERIFY_OTP_FAIL",
      entityType: "AUTH",
      entityId:
        user && typeof user === "object" && "id" in user
          ? String((user as { id?: unknown }).id)
          : null,
      referenceCode: null,
      userId:
        user && typeof user === "object" && "id" in user
          ? String((user as { id?: unknown }).id)
          : null,
      userEmail:
        user && typeof user === "object" && "email" in user
          ? String((user as { email?: unknown }).email)
          : payloadEmail || null,
      userName:
        user && typeof user === "object" && "name" in user
          ? String((user as { name?: unknown }).name)
          : null,
      ipAddress,
      userAgent,
      details: {
        ok,
        status: result.status,
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Invalid OTP verification payload", error);
    return NextResponse.json(
      { ok: false, message: "Unable to read the request body." },
      { status: 400 },
    );
  }
}
