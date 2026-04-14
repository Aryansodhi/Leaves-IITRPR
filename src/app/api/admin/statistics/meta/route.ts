import { RoleKey } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const [leaveTypes, departments, roles] = await Promise.all([
      prisma.leaveType.findMany({
        select: { id: true, name: true, code: true },
        orderBy: [{ name: "asc" }],
      }),
      prisma.department.findMany({
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      prisma.role.findMany({
        select: { key: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        leaveTypes,
        departments,
        roles,
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
      { ok: false, message: "Unable to load statistics metadata." },
      { status: 400 },
    );
  }
}
