import { NextResponse } from "next/server";

import { requestOtpHandler } from "@/server/routes/auth/request-otp";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await requestOtpHandler(payload);

    const email =
      payload && typeof payload === "object" && "email" in payload
        ? String((payload as { email?: unknown }).email ?? "")
        : "";
    const ipAddress = getRequestIp(request);
    const userAgent = request.headers.get("user-agent");
    await logAuditEvent({
      action: "AUTH_REQUEST_OTP",
      entityType: "AUTH",
      entityId: null,
      referenceCode: null,
      userId: null,
      userEmail: email || null,
      userName: null,
      ipAddress,
      userAgent,
      details: { ok: result.body?.ok ?? null },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Invalid OTP request payload", error);
    return NextResponse.json(
      { ok: false, message: "Unable to read the request body." },
      { status: 400 },
    );
  }
}
