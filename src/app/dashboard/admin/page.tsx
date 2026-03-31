import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { requireRoleForPage } from "@/server/auth/page-access";

export default async function AdminDashboardPage() {
  await requireRoleForPage("admin");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900">
            Add users
          </h1>
          <p className="text-base text-slate-600">
            Create accounts individually or onboard in bulk with CSV.
          </p>
        </header>
        <AdminUserManager />
      </div>
    </DashboardShell>
  );
}
