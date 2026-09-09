import { notFound } from "next/navigation";

import { GuestProvider } from "@/components/auth/guest-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TemplateFormRenderer } from "@/components/forms/template-form-renderer";
import type { FormTemplateSchema } from "@/components/forms/template-form-renderer";
import { getOptionalActor } from "@/server/auth/page-access";
import { prisma } from "@/server/db/prisma";

type PageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function FormTemplatePage({ params }: PageProps) {
  const actor = await getOptionalActor();
  const isGuest = !actor;

  const { templateId } = await params;

  if (!templateId) {
    notFound();
  }

  const template = await prisma.formTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true, description: true, schema: true },
  });

  if (!template) {
    notFound();
  }

  const schema = template.schema as unknown as FormTemplateSchema;
  const isAdmin = actor?.roleKey === "ADMIN";

  if (schema.lifecycle?.status === "draft" && !isAdmin) {
    return (
      <GuestProvider isGuest={isGuest}>
        <DashboardShell>
          <SurfaceCard className="border-slate-200/80 p-6">
            <p className="text-sm font-semibold text-rose-600">
              This form is still in draft and not published yet.
            </p>
          </SurfaceCard>
        </DashboardShell>
      </GuestProvider>
    );
  }

  const visibilityRoles = schema.visibilityRoles ?? [];

  // Guests can see all published forms; authenticated users respect visibility
  if (
    !isGuest &&
    actor &&
    visibilityRoles.length > 0 &&
    !visibilityRoles.includes(actor.roleKey)
  ) {
    return (
      <GuestProvider isGuest={isGuest}>
        <DashboardShell>
          <SurfaceCard className="border-slate-200/80 p-6">
            <p className="text-sm font-semibold text-rose-600">
              You do not have access to this form.
            </p>
          </SurfaceCard>
        </DashboardShell>
      </GuestProvider>
    );
  }

  const title = schema.title || template.name;
  const description = schema.description ?? template.description ?? null;

  return (
    <GuestProvider isGuest={isGuest}>
      <DashboardShell>
        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="text-base text-slate-600">{description}</p>
            ) : null}
          </header>

          <TemplateFormRenderer
            templateId={template.id}
            schema={schema}
            userEmail={actor?.email ?? "guest@example.com"}
            isGuest={isGuest}
          />
        </div>
      </DashboardShell>
    </GuestProvider>
  );
}
