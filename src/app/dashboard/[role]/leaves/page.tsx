import { redirect } from "next/navigation";

import { GuestProvider } from "@/components/auth/guest-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LeavesCatalog } from "@/components/leaves/leaves-catalog";
import { isRoleSlug } from "@/modules/roles";
import { getOptionalActor } from "@/server/auth/page-access";

type LeavesPageProps = {
  params: Promise<{ role: string }>;
};

export default async function LeavesPage({ params }: LeavesPageProps) {
  const { role } = await params;

  if (!isRoleSlug(role)) {
    redirect("/dashboard/faculty/leaves");
  }

  const actor = await getOptionalActor();
  const isGuest = !actor;

  // Authenticated user on the wrong role — redirect to their real role
  if (actor && actor.roleSlug !== role) {
    redirect(`/dashboard/${actor.roleSlug}/leaves`);
  }

  return (
    <GuestProvider isGuest={isGuest}>
      <DashboardShell>
        <LeavesCatalog role={role} />
      </DashboardShell>
    </GuestProvider>
  );
}
