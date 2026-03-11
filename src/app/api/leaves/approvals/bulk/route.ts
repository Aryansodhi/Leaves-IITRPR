import { RoleKey } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { bulkDecideLeaveApprovals } from "@/server/routes/leaves/approvals";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token, {
      roles: [RoleKey.HOD, RoleKey.ACCOUNTS, RoleKey.DEAN],
    });
    const payload = await request.json();

    const result = await bulkDecideLeaveApprovals(payload, {
      userId: actor.userId,
    });

    return NextResponse.json(
      {
        ok: result.ok,
        message: result.message,
        data: result.data,
      },
      { status: result.status },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof Error) {
      const status =
        "status" in error && typeof error.status === "number"
          ? error.status
          : 400;
      return NextResponse.json(
        { ok: false, message: error.message },
        { status },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Unable to process bulk approvals." },
      { status: 400 },
    );
  }
}
