import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  requireSessionActor,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
import {
  isValidDashboardPath,
  LAST_DASHBOARD_PATH_COOKIE,
} from "@/server/auth/last-dashboard-path";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const actor = await requireSessionActor(token).catch(() => null);
    if (actor) {
      const lastPath = cookieStore.get(LAST_DASHBOARD_PATH_COOKIE)?.value;
      if (lastPath && isValidDashboardPath(lastPath)) {
        redirect(lastPath);
      }

      const destination =
        actor.roleSlug === "admin"
          ? "/dashboard/admin"
          : `/dashboard/${actor.roleSlug}/leaves`;
      redirect(destination);
    }
  }

  // When visiting home URL without login, redirect directly to guest home
  redirect("/dashboard/faculty/leaves");
}
