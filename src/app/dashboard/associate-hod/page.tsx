import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { associateHoDDashboard } from "@/modules/roles/associate-hod/config";

export default function AssociateHodDashboardPage() {
  return (
    <DashboardShell>
      <RoleDashboard config={associateHoDDashboard} />
    </DashboardShell>
  );
}
