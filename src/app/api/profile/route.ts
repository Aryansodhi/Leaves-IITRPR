import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";

const normalizePhone = (input: unknown) => {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== 10) {
    throw new Error("Phone number must contain exactly 10 digits.");
  }
  return digits;
};

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);

    const body = (await request.json().catch(() => ({}))) as {
      phone?: unknown;
    };

    const phone = normalizePhone(body.phone);

    const updated = await prisma.user.update({
      where: { id: actor.userId },
      data: {
        phone,
      },
      select: {
        id: true,
        phone: true,
      },
    });

    await logAuditEvent({
      action: "UPDATE_PROFILE",
      entityType: "USER",
      entityId: actor.userId,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        phoneSet: Boolean(updated.phone),
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        userId: updated.id,
        phone: updated.phone ?? "",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Unable to update profile." },
      { status: 400 },
    );
  }
}
