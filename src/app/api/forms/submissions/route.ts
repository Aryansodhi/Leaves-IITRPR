import { z } from "zod";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";

const submissionSchema = z.object({
  templateId: z.string().min(1),
  data: z.record(z.string(), z.string()).default({}),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token);

    const payload = await request.json();
    const parsed = submissionSchema.parse(payload);

    const template = await prisma.formTemplate.findUnique({
      where: { id: parsed.templateId },
      select: { id: true, schema: true },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, message: "Form template not found." },
        { status: 404 },
      );
    }

    const schema = template.schema as unknown as {
      visibilityRoles?: string[];
    };

    if (
      schema?.visibilityRoles?.length &&
      !schema.visibilityRoles.includes(actor.roleKey)
    ) {
      return NextResponse.json(
        { ok: false, message: "You do not have access to this form." },
        { status: 403 },
      );
    }

    const submission = await prisma.formSubmission.create({
      data: {
        templateId: parsed.templateId,
        submittedById: actor.userId,
        data: parsed.data,
      },
    });

    await logAuditEvent({
      action: "SUBMIT_FORM_TEMPLATE",
      entityType: "FORM_SUBMISSION",
      entityId: submission.id,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        templateId: parsed.templateId,
      },
    });

    return NextResponse.json(
      { ok: true, message: "Form submitted successfully." },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, message: "Invalid submission payload." },
        { status: 400 },
      );
    }

    console.error("Form submission failed", error);
    return NextResponse.json(
      { ok: false, message: "Unable to submit the form." },
      { status: 500 },
    );
  }
}
