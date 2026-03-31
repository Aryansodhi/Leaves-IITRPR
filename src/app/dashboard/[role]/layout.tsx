import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isRoleSlug } from "@/modules/roles";
import {
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";

type RoleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ role: string }>;
};

export default async function RoleDashboardLayout({
  children,
  params,
}: RoleLayoutProps) {
  const { role } = await params;

  if (!isRoleSlug(role)) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    const actor = await requireSessionActor(token);
    if (actor.roleSlug !== role) {
      redirect(`/dashboard/${actor.roleSlug}`);
    }

    if (role === "admin") {
      redirect("/dashboard/admin");
    }
  } catch {
    redirect("/login");
  }

  return children;
}
