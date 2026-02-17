import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { staffDashboard } from "@/modules/roles/staff/config";

export default function StaffDashboardPage() {
  return (
    <DashboardShell>
      <RoleDashboard config={staffDashboard} />
    </DashboardShell>
  );
}
