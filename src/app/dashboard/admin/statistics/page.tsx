import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AdminStatisticsPanel } from "@/components/admin/admin-statistics-panel";
import { requireRoleForPage } from "@/server/auth/page-access";

export default async function AdminStatisticsPage() {
  await requireRoleForPage("admin");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900">
            Statistics
          </h1>
          <p className="text-base text-slate-600">
            Generate reports with filters, interval buckets, and export options.
          </p>
        </header>
        <AdminStatisticsPanel />
      </div>
    </DashboardShell>
  );
}
