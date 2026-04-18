import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AdminFormBuilder } from "@/components/admin/admin-form-builder";
import { requireRoleForPage } from "@/server/auth/page-access";

export default async function AdminFormBuilderPage() {
  await requireRoleForPage("admin");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Create a new form
          </h1>
          <p className="text-base text-slate-600">
            Drag, drop, and customize fields to build a new IIT Ropar form.
          </p>
        </header>
        <AdminFormBuilder />
      </div>
    </DashboardShell>
  );
}
