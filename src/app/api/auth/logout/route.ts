import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSessionCookieConfig,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";
import { LAST_DASHBOARD_PATH_COOKIE } from "@/server/auth/last-dashboard-path";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const actor = token
    ? await requireSessionActor(token).catch(() => null)
    : null;

  await logAuditEvent({
    action: "AUTH_LOGOUT",
    entityType: "AUTH",
    entityId: actor?.userId ?? null,
    referenceCode: null,
    userId: actor?.userId ?? null,
    userEmail: actor?.email ?? null,
    userName: actor?.name ?? null,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
    details: null,
  });

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    ...getSessionCookieConfig(request),
    maxAge: 0,
  });

  cookieStore.set({
    name: LAST_DASHBOARD_PATH_COOKIE,
    value: "",
    ...getSessionCookieConfig(request),
    maxAge: 0,
  });

  return NextResponse.json({ ok: true, message: "Logged out successfully." });
}
