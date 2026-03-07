"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardLogoutButton } from "@/components/dashboard/dashboard-logout-button";
import { cn } from "@/lib/utils";

const roleSlugByKey: Record<string, string> = {
  FACULTY: "faculty",
  STAFF: "staff",
  HOD: "hod",
  ASSOCIATE_HOD: "associate-hod",
  DEAN: "dean",
  REGISTRAR: "registrar",
  DIRECTOR: "director",
  ACCOUNTS: "accounts",
  ESTABLISHMENT: "establishment",
  ADMIN: "admin",
};

type ProfileData = {
  name: string;
  roleKey: string;
  roleSlug: string;
};

const resolveRoleSlug = (
  pathname: string,
  returnTo: string | null,
  roleKey: string | null,
) => {
  const dashboardMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  if (dashboardMatch?.[1]) return dashboardMatch[1];

  const returnToMatch = returnTo?.match(/^\/dashboard\/([^/]+)/);
  if (returnToMatch?.[1]) return returnToMatch[1];

  if (roleKey && roleSlugByKey[roleKey]) return roleSlugByKey[roleKey];
  return "faculty";
};

export const DashboardShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/forms/autofill", {
          method: "GET",
          cache: "no-store",
        });
        const result = (await response.json()) as {
          ok?: boolean;
          data?: ProfileData;
        };
        if (response.ok && result.ok && result.data) {
          setProfile(result.data);
          window.localStorage.setItem("lf-user-role", result.data.roleKey);
          window.localStorage.setItem("lf-user-name", result.data.name);
        }
      } catch {
        // Keep shell usable even if profile fetch fails.
      }
    };

    void loadProfile();
  }, []);

  const roleKey = profile?.roleKey ?? null;
  const roleSlug =
    profile?.roleSlug ??
    resolveRoleSlug(pathname, searchParams.get("returnTo"), roleKey);

  const leavesActive = pathname.startsWith(`/dashboard/${roleSlug}/leaves`);

  const userName = profile?.name ?? null;
  const userRole = roleKey;

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {userName ? `Welcome, ${userName}` : "Leave Workspace"}
              {userRole ? ` (${userRole})` : ""}
            </div>

            <nav className="flex flex-1 flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/${roleSlug}/leaves`}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  leavesActive
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                Leaves
              </Link>

              <Link
                href={`/dashboard/${roleSlug}/my-applications`}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  pathname.startsWith(`/dashboard/${roleSlug}/my-applications`)
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                My Applications
              </Link>

              <Link
                href={`/dashboard/${roleSlug}/approvals`}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  pathname.startsWith(`/dashboard/${roleSlug}/approvals`)
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                Approve Leaves
              </Link>

              <Link
                href={`/dashboard/${roleSlug}/profile`}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  pathname.startsWith(`/dashboard/${roleSlug}/profile`)
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                Profile
              </Link>
            </nav>
          </div>
          <DashboardLogoutButton />
        </div>
      </div>
      {children}
    </div>
  );
};
