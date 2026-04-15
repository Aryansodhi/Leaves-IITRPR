import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSessionCookieConfig,
  requireSessionActor,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";

import {
  isValidDashboardPath,
  LAST_DASHBOARD_PATH_COOKIE,
} from "@/server/auth/last-dashboard-path";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const actor = token
    ? await requireSessionActor(token).catch(() => null)
    : null;
  if (!actor) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const path =
    payload &&
    typeof payload === "object" &&
    payload !== null &&
    "path" in payload
      ? String((payload as { path?: unknown }).path ?? "")
      : "";

  if (!isValidDashboardPath(path)) {
    return NextResponse.json(
      { ok: false, message: "Invalid dashboard path." },
      { status: 400 },
    );
  }

  const baseCookie = getSessionCookieConfig(request);
  cookieStore.set({
    name: LAST_DASHBOARD_PATH_COOKIE,
    value: path,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: baseCookie.secure,
    ...(baseCookie.domain ? { domain: baseCookie.domain } : {}),
    maxAge: baseCookie.maxAge,
  });

  return NextResponse.json({ ok: true });
}
