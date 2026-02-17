import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { deanDashboard } from "@/modules/roles/dean/config";

export default function DeanDashboardPage() {
  return (
    <DashboardShell>
      <RoleDashboard config={deanDashboard} />
    </DashboardShell>
  );
}
