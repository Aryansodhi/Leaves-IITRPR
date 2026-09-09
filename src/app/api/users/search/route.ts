import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  const where: Prisma.UserWhereInput = q
    ? {
        isActive: true,
        OR: [
          { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : { isActive: true };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      designation: true,
      department: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 50,
  });

  const mapped = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    designation: u.designation,
    department: u.department?.name ?? null,
  }));

  return NextResponse.json({ ok: true, data: mapped });
}
