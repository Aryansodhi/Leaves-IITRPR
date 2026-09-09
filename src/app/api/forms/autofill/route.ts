import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { startOfYear } from "date-fns";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);

    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      include: {
        department: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Unable to load user profile." },
        { status: 404 },
      );
    }
    // include earned leave balance for display in profile
    const currentPeriodStart = startOfYear(new Date());
    const earnedType = await prisma.leaveType.findFirst({
      where: {
        OR: [
          { code: "EL" },
          { name: { contains: "Earned", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true },
    });

    let balanceData = null;
    if (earnedType) {
      const balance = await prisma.leaveBalance.findFirst({
        where: {
          userId: user.id,
          leaveTypeId: earnedType.id,
          periodStart: currentPeriodStart,
        },
      });

      const allocated = balance?.totalAllocated ?? 20;
      const consumed = balance?.totalConsumed ?? 0;
      const encashed = balance?.totalEncashed ?? 0;
      const available = Math.max(0, allocated - consumed - encashed);

      balanceData = {
        leaveType: earnedType.name,
        totalAllocated: allocated,
        totalConsumed: consumed,
        totalEncashed: encashed,
        available,
      };
    }

    return NextResponse.json({
      ok: true,
      data: {
        userId: user.id,
        name: user.name ?? "",
        designation: user.designation ?? "",
        department: user.department?.name ?? "",
        employeeCode: user.employeeCode ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",
        roleKey: user.role?.key ?? actor.roleKey,
        roleSlug: actor.roleSlug,
        todayDisplay: new Date().toLocaleDateString("en-GB"),
        earnedLeaveBalance: balanceData,
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
      { ok: false, message: "Unable to load autofill profile." },
      { status: 400 },
    );
  }
}
