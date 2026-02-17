import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { establishmentDashboard } from "@/modules/roles/establishment/config";

export default function EstablishmentDashboardPage() {
  return (
    <DashboardShell>
      <RoleDashboard config={establishmentDashboard} />
    </DashboardShell>
  );
}
