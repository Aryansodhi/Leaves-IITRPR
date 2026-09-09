import { redirect } from "next/navigation";

import { GuestProvider } from "@/components/auth/guest-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { GuestSignInCard } from "@/components/auth/guest-sign-in-card";
import { ProfileDetailsCard } from "@/components/profile/profile-details-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { isRoleSlug } from "@/modules/roles";
import { getOptionalActor } from "@/server/auth/page-access";

type ProfilePageProps = {
  params: Promise<{ role: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { role } = await params;

  if (!isRoleSlug(role)) {
    redirect("/dashboard/faculty/leaves");
  }

  const actor = await getOptionalActor();
  const isGuest = !actor;

  if (actor && actor.roleSlug !== role) {
    redirect(`/dashboard/${actor.roleSlug}/profile`);
  }

  return (
    <GuestProvider isGuest={isGuest}>
      <DashboardShell>
        {isGuest ? (
          <GuestSignInCard
            title="My Profile"
            description="Sign in to view your personal and role information used across leave workflows."
          />
        ) : (
          <>
            <SurfaceCard className="space-y-2 border-slate-200/80 p-5">
              <p className="text-2xl font-semibold text-slate-900">
                My Profile
              </p>
              <p className="text-sm text-slate-600">
                View your personal and role information used across leave
                workflows.
              </p>
            </SurfaceCard>
            <ProfileDetailsCard />
          </>
        )}
      </DashboardShell>
    </GuestProvider>
  );
}
