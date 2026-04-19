import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireSignedInForPage } from "@/server/auth/page-access";
import { prisma } from "@/server/db/prisma";

export default async function FormsPage() {
  const actor = await requireSignedInForPage();

  const forms = await prisma.formTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      schema: true,
    },
  });

  const visibleForms = forms.filter((form) => {
    const schema = form.schema as unknown as {
      visibilityRoles?: string[];
      lifecycle?: {
        status?: "draft" | "published";
      };
    };

    if (schema?.lifecycle?.status === "draft") {
      return false;
    }

    if (!schema?.visibilityRoles?.length) return true;
    return schema.visibilityRoles.includes(actor.roleKey);
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Forms
          </h1>
          <p className="text-base text-slate-600">
            Open a form, fill it, and submit your details.
          </p>
        </header>

        <div className="grid gap-4">
          {visibleForms.length === 0 ? (
            <SurfaceCard className="border-slate-200/80 p-4">
              <p className="text-sm text-slate-600">No forms available.</p>
            </SurfaceCard>
          ) : (
            visibleForms.map((form) => (
              <SurfaceCard
                key={form.id}
                className="flex flex-col gap-3 border-slate-200/80 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-base font-semibold text-slate-900">
                    {form.name}
                  </p>
                  {form.description ? (
                    <p className="text-sm text-slate-600">{form.description}</p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    Created {form.createdAt.toLocaleDateString("en-GB")}
                  </p>
                </div>

                <Button asChild>
                  <Link href={`/dashboard/forms/${form.id}`}>Open form</Link>
                </Button>
              </SurfaceCard>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
