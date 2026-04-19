import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TemplateFormRenderer } from "@/components/forms/template-form-renderer";
import type { FormTemplateSchema } from "@/components/forms/template-form-renderer";
import { requireSignedInForPage } from "@/server/auth/page-access";
import { prisma } from "@/server/db/prisma";

type PageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function FormTemplatePage({ params }: PageProps) {
  const actor = await requireSignedInForPage();

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
  if (schema.lifecycle?.status === "draft") {
    return (
      <DashboardShell>
        <SurfaceCard className="border-slate-200/80 p-6">
          <p className="text-sm font-semibold text-rose-600">
            This form is still in draft and not published yet.
          </p>
        </SurfaceCard>
      </DashboardShell>
    );
  }

  const visibilityRoles = schema.visibilityRoles ?? [];

  if (visibilityRoles.length > 0 && !visibilityRoles.includes(actor.roleKey)) {
    return (
      <DashboardShell>
        <SurfaceCard className="border-slate-200/80 p-6">
          <p className="text-sm font-semibold text-rose-600">
            You do not have access to this form.
          </p>
        </SurfaceCard>
      </DashboardShell>
    );
  }

  const title = schema.title || template.name;
  const description = schema.description ?? template.description ?? null;

  return (
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

        <TemplateFormRenderer templateId={template.id} schema={schema} />
      </div>
    </DashboardShell>
  );
}
