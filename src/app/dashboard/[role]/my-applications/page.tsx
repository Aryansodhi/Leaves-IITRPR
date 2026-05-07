import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MySubmissionsPanel } from "@/components/leaves/my-submissions-panel";
import { SurfaceCard } from "@/components/ui/surface-card";
import { isRoleSlug } from "@/modules/roles";
import { requireRoleForPage } from "@/server/auth/page-access";

type MyApplicationsPageProps = {
  params: Promise<{ role: string }>;
};

export default async function MyApplicationsPage({
  params,
}: MyApplicationsPageProps) {
  const { role } = await params;

  if (!isRoleSlug(role)) {
    redirect("/login");
  }

  await requireRoleForPage(role);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <SurfaceCard className="space-y-2 border-slate-200/80 p-5">
          <p className="text-2xl font-semibold text-slate-900">
            My Applications
          </p>
          <p className="text-sm text-slate-600">
            Track all leave requests submitted by you with current status and
            history.
          </p>
        </SurfaceCard>
        <MySubmissionsPanel />
      </div>
    </DashboardShell>
  );
}
