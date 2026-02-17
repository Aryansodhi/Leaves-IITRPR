import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { directorDashboard } from "@/modules/roles/director/config";

export default function DirectorDashboardPage() {
  return (
    <DashboardShell>
      <RoleDashboard config={directorDashboard} />
    </DashboardShell>
  );
}
