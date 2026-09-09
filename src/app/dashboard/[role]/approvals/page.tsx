import { redirect } from "next/navigation";

import { GuestProvider } from "@/components/auth/guest-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { GuestSignInCard } from "@/components/auth/guest-sign-in-card";
import { StationLeaveApprovals } from "@/components/leaves/station-leave-approvals";
import { isRoleSlug } from "@/modules/roles";
import { getOptionalActor } from "@/server/auth/page-access";

type ApprovalsPageProps = {
  params: Promise<{ role: string }>;
};

export default async function ApprovalsPage({ params }: ApprovalsPageProps) {
  const { role } = await params;

  if (!isRoleSlug(role)) {
    redirect("/dashboard/faculty/leaves");
  }

  const actor = await getOptionalActor();
  const isGuest = !actor;

  if (actor && actor.roleSlug !== role) {
    redirect(`/dashboard/${actor.roleSlug}/approvals`);
  }

  return (
    <GuestProvider isGuest={isGuest}>
      <DashboardShell>
        {isGuest ? (
          <GuestSignInCard
            title="Approve Leaves"
            description="Sign in to view and act on pending leave approvals assigned to your role."
          />
        ) : (
          <StationLeaveApprovals role={role} />
        )}
      </DashboardShell>
    </GuestProvider>
  );
}
