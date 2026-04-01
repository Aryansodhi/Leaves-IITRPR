import { RoleKey, Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

const parseDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const userQuery = url.searchParams.get("user");
    const ip = url.searchParams.get("ip");
    const reference = url.searchParams.get("reference");
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 200)
      : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.userId = userId;
    if (ip) where.ipAddress = { contains: ip };
    if (reference)
      where.referenceCode = { contains: reference, mode: "insensitive" };

    if (userQuery) {
      where.OR = [
        { userEmail: { contains: userQuery, mode: "insensitive" } },
        { userName: { contains: userQuery, mode: "insensitive" } },
      ];
    }

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        total,
        limit,
        offset,
        logs,
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
      { ok: false, message: "Unable to load audit logs." },
      { status: 400 },
    );
  }
}
