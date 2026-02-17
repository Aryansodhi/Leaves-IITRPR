import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { hodDashboard } from "@/modules/roles/hod/config";

export default function HodDashboardPage() {
  return (
    <DashboardShell>
      <RoleDashboard config={hodDashboard} />
    </DashboardShell>
  );
}
