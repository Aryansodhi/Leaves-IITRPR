import { RoleKey } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";
import {
  createFormTemplateHandler,
  deleteFormTemplateHandler,
  updateFormTemplateHandler,
} from "@/server/routes/admin/form-templates";
import { prisma } from "@/server/db/prisma";
import { getRequestIp, logAuditEvent } from "@/server/audit/logger";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "Template id is required." },
        { status: 400 },
      );
    }

    const template = await prisma.formTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        schema: true,
        updatedAt: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, message: "Form template not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: template,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("Unable to load form template", error);
    return NextResponse.json(
      { ok: false, message: "Unable to load form template." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const payload = await request.json();
    const result = await createFormTemplateHandler(payload, actor.userId);

    const name =
      payload && typeof payload === "object" && "name" in payload
        ? String((payload as { name?: unknown }).name ?? "")
        : "";

    await logAuditEvent({
      action: "ADMIN_CREATE_FORM_TEMPLATE",
      entityType: "FORM_TEMPLATE",
      entityId: result.body.data?.id ?? null,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        ok: result.body.ok ?? null,
        name: name || null,
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("Invalid admin form payload", error);
    return NextResponse.json(
      { ok: false, message: "Unable to read the request body." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const payload = await request.json();
    const result = await updateFormTemplateHandler(payload);

    const templateId =
      payload && typeof payload === "object" && "id" in payload
        ? String((payload as { id?: unknown }).id ?? "")
        : "";
    const name =
      payload && typeof payload === "object" && "name" in payload
        ? String((payload as { name?: unknown }).name ?? "")
        : "";

    await logAuditEvent({
      action: "ADMIN_UPDATE_FORM_TEMPLATE",
      entityType: "FORM_TEMPLATE",
      entityId: templateId || null,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        ok: result.body.ok ?? null,
        name: name || null,
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("Invalid admin form update payload", error);
    return NextResponse.json(
      { ok: false, message: "Unable to read the request body." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const actor = await requireSessionActor(token, { roles: [RoleKey.ADMIN] });

    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? "";
    const result = await deleteFormTemplateHandler({ id });

    await logAuditEvent({
      action: "ADMIN_DELETE_FORM_TEMPLATE",
      entityType: "FORM_TEMPLATE",
      entityId: id || null,
      referenceCode: null,
      userId: actor.userId,
      userEmail: actor.email,
      userName: actor.name,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      details: {
        ok: result.body.ok ?? null,
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("Invalid admin form delete request", error);
    return NextResponse.json(
      { ok: false, message: "Unable to process delete request." },
      { status: 400 },
    );
  }
}
