import { differenceInSeconds, addMinutes } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/env";
import { generateOtp, hashOtp } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/email/mailer";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  email: z.string().email(),
});

const maskEmail = (email: string) => {
  const [userPart, domain] = email.split("@");
  const visible = userPart.slice(0, 2);
  return `${visible}***@${domain}`;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { email } = requestSchema.parse(payload);
    const normalizedEmail = email.trim().toLowerCase();

    const recentToken = await prisma.otpToken.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: "desc" },
    });

    if (
      recentToken &&
      differenceInSeconds(new Date(), recentToken.createdAt) < 45
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Please wait a few seconds before requesting another code.",
        },
        { status: 429 },
      );
    }

    await prisma.otpToken.deleteMany({
      where: {
        email: normalizedEmail,
        OR: [{ consumedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
      },
    });

    const userNameFromEmail = normalizedEmail
      .split("@")[0]
      ?.split(/[._]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
      .trim();

    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: {
        email: normalizedEmail,
        name: userNameFromEmail || "Institute Member",
        isTeaching: false,
      },
    });

    const otp = generateOtp();
    const tokenHash = await hashOtp(otp);
    const expiresAt = addMinutes(new Date(), env.OTP_EXP_MINUTES);

    await prisma.otpToken.create({
      data: {
        email: normalizedEmail,
        tokenHash,
        expiresAt,
        userId: user.id,
      },
    });

    await sendOtpEmail(normalizedEmail, otp);

    return NextResponse.json({
      ok: true,
      message: `OTP sent to ${maskEmail(normalizedEmail)}`,
    });
  } catch (error) {
    console.error("OTP request failed", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Unable to send OTP right now. Please try again shortly.",
      },
      { status: 500 },
    );
  }
}
