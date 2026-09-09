import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { RoleSlug } from "@/modules/roles";
import {
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";

export const requireSignedInForPage = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    return await requireSessionActor(token);
  } catch {
    redirect("/login");
  }
};

export const requireRoleForPage = async (role: RoleSlug) => {
  const actor = await requireSignedInForPage();
  if (actor.roleSlug !== role) {
    redirect(`/dashboard/${actor.roleSlug}`);
  }
  return actor;
};

/** Returns the session actor or `null` when the user is not authenticated.
 *  Unlike `requireSignedInForPage` this never redirects — it is used by
 *  pages that support guest (read-only) access. */
export const getOptionalActor = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await requireSessionActor(token);
  } catch {
    return null;
  }
};
