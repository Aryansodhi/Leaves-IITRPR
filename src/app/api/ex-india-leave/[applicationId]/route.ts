import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const { applicationId } = await context.params;
  if (!applicationId)
    return NextResponse.json(
      { ok: false, error: "Missing applicationId" },
      { status: 400 },
    );

  const application = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      approvalSteps: {
        orderBy: { sequence: "asc" },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              employeeCode: true,
              designation: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!application)
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );

  return NextResponse.json({ ok: true, data: application });
}
