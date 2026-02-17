import { differenceInMinutes } from "date-fns";
import { RoleKey } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyOtp } from "@/lib/auth/otp";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/modules/roles";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const roleSlugMap: Record<RoleKey, RoleSlug> = {
  [RoleKey.FACULTY]: "faculty",
  [RoleKey.STAFF]: "staff",
  [RoleKey.HOD]: "hod",
  [RoleKey.ASSOCIATE_HOD]: "associate-hod",
  [RoleKey.DEAN]: "dean",
  [RoleKey.REGISTRAR]: "registrar",
  [RoleKey.DIRECTOR]: "director",
  [RoleKey.ACCOUNTS]: "accounts",
  [RoleKey.ESTABLISHMENT]: "establishment",
};

const resolveRoleKey = (
  providedKey: RoleKey | null | undefined,
  isTeaching: boolean,
) => {
  if (providedKey) return providedKey;
  return isTeaching ? RoleKey.FACULTY : RoleKey.STAFF;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { email, code } = verifySchema.parse(payload);
    const normalizedEmail = email.trim().toLowerCase();

    const token = await prisma.otpToken.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: "desc" },
    });

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Please request a fresh OTP." },
        { status: 404 },
      );
    }

    if (token.consumedAt) {
      return NextResponse.json(
        { ok: false, message: "This OTP has already been used." },
        { status: 410 },
      );
    }

    if (token.expiresAt < new Date()) {
      return NextResponse.json(
        { ok: false, message: "The OTP has expired. Request a new one." },
        { status: 410 },
      );
    }

    const match = await verifyOtp(code, token.tokenHash);
    if (!match) {
      await prisma.otpToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });

      return NextResponse.json(
        { ok: false, message: "Incorrect code. Please try again." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true },
    });
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Account not found." },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.otpToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: "New sign-in",
        body: `OTP sign-in completed ${differenceInMinutes(new Date(), token.createdAt)} minutes after request.`,
        type: "AUTH",
      },
    });

    const resolvedRoleKey = resolveRoleKey(user.role?.key, user.isTeaching);
    const roleSlug = roleSlugMap[resolvedRoleKey];

    return NextResponse.json({
      ok: true,
      message: "Signed in successfully.",
      role: roleSlug,
      redirectTo: `/dashboard/${roleSlug}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleKey: resolvedRoleKey,
      },
    });
  } catch (error) {
    console.error("OTP verify failed", error);
    return NextResponse.json(
      { ok: false, message: "Unable to verify OTP right now." },
      { status: 500 },
    );
  }
}
