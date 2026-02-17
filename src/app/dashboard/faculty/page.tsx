import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { facultyDashboard } from "@/modules/roles/faculty/config";

export default function FacultyDashboardPage() {
  return (
    <DashboardShell>
      <RoleDashboard config={facultyDashboard} />
    </DashboardShell>
  );
}
