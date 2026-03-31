"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { DashboardLogoutButton } from "@/components/dashboard/dashboard-logout-button";
import { Button } from "@/components/ui/button";
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
  const [showActingHodNav, setShowActingHodNav] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

          if (result.data.roleKey === "HOD") {
            try {
              const actingResponse = await fetch("/api/leaves/acting-hod", {
                method: "GET",
                cache: "no-store",
              });

              const actingResult = (await actingResponse.json()) as {
                ok?: boolean;
                data?: { isOnLeave?: boolean };
              };

              setShowActingHodNav(
                Boolean(
                  actingResponse.ok &&
                  actingResult.ok &&
                  actingResult.data?.isOnLeave,
                ),
              );
            } catch {
              setShowActingHodNav(false);
            }
          } else {
            setShowActingHodNav(false);
          }
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

  const isAdminShell = roleSlug === "admin" || roleKey === "ADMIN";
  const leavesActive = pathname.startsWith(`/dashboard/${roleSlug}/leaves`);

  const userName = profile?.name ?? null;
  const userRole = roleKey;
  const isActingHodNavSelected =
    pathname.startsWith(`/dashboard/${roleSlug}/approvals`) &&
    searchParams.get("section") === "acting-hod";

  const navItems = isAdminShell
    ? [
        {
          label: "Add Users",
          href: "/dashboard/admin",
          active: pathname.startsWith("/dashboard/admin"),
        },
      ]
    : [
        {
          label: "Leaves",
          href: `/dashboard/${roleSlug}/leaves`,
          active: leavesActive,
        },
        {
          label: "My Applications",
          href: `/dashboard/${roleSlug}/my-applications`,
          active: pathname.startsWith(`/dashboard/${roleSlug}/my-applications`),
        },
        {
          label: "Approve Leaves",
          href: `/dashboard/${roleSlug}/approvals`,
          active:
            pathname.startsWith(`/dashboard/${roleSlug}/approvals`) &&
            !isActingHodNavSelected,
        },
        {
          label: "Profile",
          href: `/dashboard/${roleSlug}/profile`,
          active: pathname.startsWith(`/dashboard/${roleSlug}/profile`),
        },
      ];

  if (!isAdminShell && roleKey === "HOD" && showActingHodNav) {
    navItems.splice(3, 0, {
      label: "Appoint Acting HoD",
      href: `/dashboard/${roleSlug}/approvals?section=acting-hod`,
      active: isActingHodNavSelected,
    });
  }

  useEffect(() => {
    if (!mobileNavOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4 sm:py-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="sm:hidden px-3 py-2"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              aria-controls="dashboard-mobile-nav"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>

            <Image
              src="/iit_ropar.png"
              alt="IIT Ropar Logo"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
              priority
            />

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {userName ? `Welcome, ${userName}` : "Leave Workspace"}
                {userRole ? ` (${userRole})` : ""}
              </div>

              <nav className="hidden sm:flex flex-1 flex-wrap items-center gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      item.active
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <DashboardLogoutButton />
        </div>
      </div>

      {mobileNavOpen && (
        <div
          className="sm:hidden fixed inset-0 z-50"
          aria-hidden={!mobileNavOpen}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/30"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside
            id="dashboard-mobile-nav"
            className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white border-r border-slate-200 shadow-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">Menu</div>
              <Button
                variant="ghost"
                className="px-3 py-2"
                aria-label="Close menu"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="p-3 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "block rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    item.active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-900 hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {children}
    </div>
  );
};
