import crypto from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/env";

const STATE_COOKIE = "lf_google_oauth_state";
const STATE_TTL_SECONDS = 60 * 10;

const isSecureRequest = (request: Request) => {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto === "https";
  return new URL(request.url).protocol === "https:";
};

export async function GET(request: Request) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    const params = new URLSearchParams({
      error: "Google sign-in is not configured yet.",
    });
    return NextResponse.redirect(
      new URL(`/login?${params.toString()}`, request.url),
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  const secureCookie = isSecureRequest(request);

  cookieStore.set({
    name: STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
    hd: "iitrpr.ac.in",
    access_type: "online",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
