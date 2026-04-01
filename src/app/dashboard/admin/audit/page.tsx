import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { requireRoleForPage } from "@/server/auth/page-access";

export default async function AdminAuditPage() {
  await requireRoleForPage("admin");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900">
            Audit logs
          </h1>
          <p className="text-base text-slate-600">
            Review system activity and filter by user, time, or IP address.
          </p>
        </header>
        <AuditLogPanel />
      </div>
    </DashboardShell>
  );
}
