import { cookies } from "next/headers";

import {
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  // If token exists, validate it; if invalid, still allow guest access.
  // Authenticated users proceed normally; guests see read-only views.
  if (token) {
    try {
      await requireSessionActor(token);
    } catch {
      // Token invalid/expired — fall through to guest mode
    }
  }

  return children;
}
