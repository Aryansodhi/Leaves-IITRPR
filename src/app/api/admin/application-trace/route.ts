import { RoleKey } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const url = new URL(request.url);
    const referenceCode = url.searchParams.get("referenceCode")?.trim();

    if (!referenceCode) {
      return NextResponse.json(
        { ok: false, message: "Reference code is required." },
        { status: 400 },
      );
    }

    const application = await prisma.leaveApplication.findUnique({
      where: { referenceCode },
      include: {
        leaveType: true,
        applicant: {
          include: { role: true, department: true },
        },
        approvalSteps: {
          include: {
            assignedTo: { select: { name: true, email: true } },
            actedBy: { select: { name: true, email: true } },
            escalatedTo: { select: { name: true, email: true } },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { ok: false, message: "Leave application not found." },
        { status: 404 },
      );
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { referenceCode: application.referenceCode },
          { entityId: application.id },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      data: {
        application,
        auditLogs,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Unable to load application trace." },
      { status: 400 },
    );
  }
}
