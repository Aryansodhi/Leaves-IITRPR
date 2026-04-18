import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireRoleForPage } from "@/server/auth/page-access";
import { prisma } from "@/server/db/prisma";

export default async function AdminFormsPage() {
  await requireRoleForPage("admin");

  let forms: Array<{
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    schema: unknown;
  }> = [];
  let loadError: string | null = null;

  try {
    forms = await prisma.formTemplate.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        schema: true,
      },
    });
  } catch (error) {
    console.error("Unable to load form templates", error);
    loadError = "Unable to load saved forms right now.";
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Forms
          </h1>
          <p className="text-base text-slate-600">
            Saved forms created in the builder.
          </p>
        </header>

        <div className="grid gap-4">
          {loadError ? (
            <SurfaceCard className="border-slate-200/80 p-4">
              <p className="text-sm text-rose-600">{loadError}</p>
            </SurfaceCard>
          ) : forms.length === 0 ? (
            <SurfaceCard className="border-slate-200/80 p-4">
              <p className="text-sm text-slate-600">No forms found.</p>
            </SurfaceCard>
          ) : (
            forms.map((form) => {
              const schema = form.schema as unknown as {
                visibilityRoles?: string[];
                version?: number;
              };

              return (
                <SurfaceCard
                  key={form.id}
                  className="space-y-2 border-slate-200/80 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {form.name}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">
                      {form.createdAt.toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <div>
                    <Button asChild variant="secondary">
                      <Link href={`/dashboard/forms/${form.id}`}>
                        Open form
                      </Link>
                    </Button>
                  </div>
                  {form.description ? (
                    <p className="text-sm text-slate-600">{form.description}</p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    {schema?.version ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        v{schema.version}
                      </span>
                    ) : null}
                    {schema?.visibilityRoles?.length ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        Visible to: {schema.visibilityRoles.join(", ")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        Visible to: (not set)
                      </span>
                    )}
                  </div>
                </SurfaceCard>
              );
            })
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
