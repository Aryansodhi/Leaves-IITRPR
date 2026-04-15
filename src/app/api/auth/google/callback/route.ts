import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/env";
import {
  createSessionToken,
  getSessionCookieConfig,
  getRoleSlugFromKey,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";
import { RoleKey } from "@prisma/client";

const STATE_COOKIE = "lf_google_oauth_state";

const redirectWithError = (message: string, baseUrl: string) => {
  const params = new URLSearchParams({
    error: message,
  });
  return NextResponse.redirect(new URL(`/login?${params.toString()}`, baseUrl));
};

const isSecureRequest = (request: Request) => {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto === "https";
  return new URL(request.url).protocol === "https:";
};

export async function GET(request: Request) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return redirectWithError(
      "Google sign-in is not configured yet.",
      request.url,
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;
  const secureCookie = isSecureRequest(request);
  const clearStateCookie = {
    name: STATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  if (!code || !state || !stateCookie || state !== stateCookie) {
    const response = redirectWithError(
      "Invalid OAuth state. Please try again.",
      request.url,
    );
    response.cookies.set(clearStateCookie);
    return response;
  }

  try {
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      console.error("Google token exchange failed", text);
      const response = redirectWithError(
        "Unable to sign in with Google right now.",
        request.url,
      );
      response.cookies.set(clearStateCookie);
      return response;
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      id_token?: string;
    };

    if (!tokenPayload.access_token) {
      const response = redirectWithError(
        "Google sign-in did not return access token.",
        request.url,
      );
      response.cookies.set(clearStateCookie);
      return response;
    }

    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      },
    );

    if (!userResponse.ok) {
      const text = await userResponse.text();
      console.error("Google userinfo failed", text);
      const response = redirectWithError(
        "Unable to verify Google account.",
        request.url,
      );
      response.cookies.set(clearStateCookie);
      return response;
    }

    const profile = (await userResponse.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    };

    const email = (profile.email ?? "").toLowerCase();
    if (!email.endsWith("@iitrpr.ac.in") || profile.email_verified !== true) {
      await logAuditEvent({
        action: "AUTH_GOOGLE_FAIL",
        entityType: "AUTH",
        entityId: null,
        referenceCode: null,
        userId: null,
        userEmail: email || null,
        userName: profile.name ?? null,
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
        details: {
          reason: "unauthorized-domain",
        },
      });
      const response = redirectWithError(
        "Please use your verified @iitrpr.ac.in email to sign in.",
        request.url,
      );
      response.cookies.set(clearStateCookie);
      return response;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      await logAuditEvent({
        action: "AUTH_GOOGLE_FAIL",
        entityType: "AUTH",
        entityId: null,
        referenceCode: null,
        userId: user?.id ?? null,
        userEmail: email,
        userName: profile.name ?? null,
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
        details: {
          reason: "not-registered",
        },
      });
      const response = redirectWithError(
        "This email is not registered with the leave portal.",
        request.url,
      );
      response.cookies.set(clearStateCookie);
      return response;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: "New sign-in",
        body: "Google sign-in completed successfully.",
        type: "AUTH",
      },
    });

    const resolvedRole =
      user.role?.key ?? (user.isTeaching ? RoleKey.FACULTY : RoleKey.STAFF);
    const roleSlug = getRoleSlugFromKey(resolvedRole);
    const sessionToken = createSessionToken({
      userId: user.id,
      roleKey: resolvedRole,
    });

    await logAuditEvent({
      action: "AUTH_GOOGLE_SUCCESS",
      entityType: "AUTH",
      entityId: user.id,
      referenceCode: null,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        role: resolvedRole,
      },
    });

    const destination =
      roleSlug === "admin"
        ? "/dashboard/admin"
        : `/dashboard/${roleSlug}/leaves`;

    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.set(clearStateCookie);
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      ...getSessionCookieConfig(request),
    });
    return response;
  } catch (error) {
    console.error("Google OAuth failed", error);
    const response = redirectWithError(
      "Unable to sign in with Google.",
      request.url,
    );
    response.cookies.set(clearStateCookie);
    return response;
  }
}
