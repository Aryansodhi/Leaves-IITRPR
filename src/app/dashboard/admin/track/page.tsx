import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ApplicationTracker } from "@/components/admin/application-tracker";
import { requireRoleForPage } from "@/server/auth/page-access";

export default async function AdminTrackPage() {
  await requireRoleForPage("admin");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900">
            Track applications
          </h1>
          <p className="text-base text-slate-600">
            Look up a leave reference code and review the full form details.
          </p>
        </header>
        <ApplicationTracker />
      </div>
    </DashboardShell>
  );
}
