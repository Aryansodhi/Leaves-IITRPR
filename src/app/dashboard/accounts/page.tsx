import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { accountsDashboard } from "@/modules/roles/accounts/config";

export default function AccountsDashboardPage() {
  return (
    <DashboardShell>
      <RoleDashboard config={accountsDashboard} />
    </DashboardShell>
  );
}
