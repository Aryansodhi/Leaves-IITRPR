import crypto from "node:crypto";
import { RoleKey } from "@prisma/client";

import type { RoleSlug } from "@/modules/roles";
import { prisma } from "@/server/db/prisma";

export const SESSION_COOKIE_NAME = "lf_session";

const SESSION_SECRET =
  process.env.AUTH_SECRET ?? "dev-session-secret-change-me";
const SESSION_TTL_SECONDS = Number(
  process.env.AUTH_SESSION_SECONDS ?? 60 * 60 * 12,
);

const roleSlugByKey: Record<RoleKey, RoleSlug> = {
  FACULTY: "faculty",
  STAFF: "staff",
  HOD: "hod",
  ASSOCIATE_HOD: "associate-hod",
  DEAN: "dean",
  REGISTRAR: "registrar",
  DIRECTOR: "director",
  ACCOUNTS: "accounts",
  ESTABLISHMENT: "establishment",
  ADMIN: "admin",
};

const roleKeyBySlug: Record<RoleSlug, RoleKey> = {
  faculty: RoleKey.FACULTY,
  staff: RoleKey.STAFF,
  hod: RoleKey.HOD,
  "associate-hod": RoleKey.ASSOCIATE_HOD,
  dean: RoleKey.DEAN,
  registrar: RoleKey.REGISTRAR,
  director: RoleKey.DIRECTOR,
  accounts: RoleKey.ACCOUNTS,
  establishment: RoleKey.ESTABLISHMENT,
  admin: RoleKey.ADMIN,
};

type SessionPayload = {
  sub: string;
  role: RoleKey;
  exp: number;
};

const toBase64Url = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const fromBase64Url = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const signPart = (value: string) =>
  crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export const getRoleSlugFromKey = (roleKey: RoleKey): RoleSlug =>
  roleSlugByKey[roleKey];
export const getRoleKeyFromSlug = (slug: RoleSlug): RoleKey =>
  roleKeyBySlug[slug];

export const createSessionToken = (input: {
  userId: string;
  roleKey: RoleKey;
  ttlSeconds?: number;
}) => {
  const exp =
    Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? SESSION_TTL_SECONDS);
  const payload: SessionPayload = {
    sub: input.userId,
    role: input.roleKey,
    exp,
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = signPart(payloadB64);
  return `${payloadB64}.${sig}`;
};

const verifySessionToken = (token: string): SessionPayload => {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    throw new AuthError("Invalid session token.");
  }

  const expected = signPart(payloadB64);
  if (signature !== expected) {
    throw new AuthError("Invalid session signature.");
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadB64)) as SessionPayload;
  } catch {
    throw new AuthError("Invalid session payload.");
  }

  if (!payload.sub || !payload.role || !payload.exp) {
    throw new AuthError("Invalid session payload.");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AuthError("Session expired. Please sign in again.");
  }

  return payload;
};

export const sessionCookieConfig = {
  httpOnly: true,
  secure: (() => {
    const override = process.env.AUTH_COOKIE_SECURE;
    if (override === "true") return true;
    if (override === "false") return false;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return (
      process.env.NODE_ENV === "production" && appUrl.startsWith("https://")
    );
  })(),
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

const getSecureFromRequest = (request: Request) => {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto === "https";
  return new URL(request.url).protocol === "https:";
};

export const getSessionCookieConfig = (request?: Request) => {
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
  const domain =
    cookieDomain && cookieDomain.trim().length > 0
      ? cookieDomain.trim()
      : undefined;

  const secure = request
    ? getSecureFromRequest(request)
    : sessionCookieConfig.secure;

  return {
    ...sessionCookieConfig,
    ...(domain ? { domain } : {}),
    secure,
  };
};

export const requireSessionActor = async (
  token: string | undefined,
  options?: { roles?: RoleKey[] },
) => {
  if (!token) {
    throw new AuthError("Sign in required.", 401);
  }

  const payload = verifySessionToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw new AuthError("Account not active.", 403);
  }

  const roleKey = user.role?.key ?? payload.role;
  if (options?.roles && !options.roles.includes(roleKey)) {
    throw new AuthError("You do not have permission for this action.", 403);
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roleKey,
    roleSlug: getRoleSlugFromKey(roleKey),
  };
};
