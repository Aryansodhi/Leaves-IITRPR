import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { ApplicationTracker } from "@/components/admin/application-tracker";
import { requireRoleForPage } from "@/server/auth/page-access";

export default async function AdminDashboardPage() {
  await requireRoleForPage("admin");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900">
            Admin console
          </h1>
          <p className="text-base text-slate-600">
            Manage users, audit activity, and track leave applications.
          </p>
        </header>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Add users</h2>
          <AdminUserManager />
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Audit</h2>
          <AuditLogPanel />
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">
            Application tracker
          </h2>
          <ApplicationTracker />
        </section>
      </div>
    </DashboardShell>
  );
}
