import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { registrarDashboard } from "@/modules/roles/registrar/config";

export default function RegistrarDashboardPage() {
  return (
    <DashboardShell>
      <RoleDashboard config={registrarDashboard} />
    </DashboardShell>
  );
}
