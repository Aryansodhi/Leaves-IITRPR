"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LogIn, Menu, X } from "lucide-react";

import { useGuest } from "@/components/auth/guest-context";
import { DashboardLogoutButton } from "@/components/dashboard/dashboard-logout-button";
import { GuideButton } from "@/components/dashboard/guide-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isRoleSlug } from "@/modules/roles";

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
  if (dashboardMatch?.[1] && isRoleSlug(dashboardMatch[1])) {
    return dashboardMatch[1];
  }

  const returnToMatch = returnTo?.match(/^\/dashboard\/([^/]+)/);
  if (returnToMatch?.[1] && isRoleSlug(returnToMatch[1])) {
    return returnToMatch[1];
  }

  if (roleKey && roleSlugByKey[roleKey]) return roleSlugByKey[roleKey];
  return "faculty";
};

/** Items in the guest navigation that should trigger the login modal. */
const GUEST_PROTECTED_LABELS = new Set([
  "My Applications",
  "Approve Leaves",
  "Profile",
]);

export const DashboardShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isGuest, promptLogin } = useGuest();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [showActingHodNav, setShowActingHodNav] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (isGuest) return; // Skip profile fetch for guests

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
  }, [isGuest]);

  const roleKey = profile?.roleKey ?? null;
  const roleSlug =
    profile?.roleSlug ??
    resolveRoleSlug(pathname, searchParams.get("returnTo"), roleKey);

  const isAdminShell = roleSlug === "admin" || roleKey === "ADMIN";
  const leavesActive = pathname.startsWith(`/dashboard/${roleSlug}/leaves`);

  const userName = isGuest ? null : (profile?.name ?? null);
  const userRole = isGuest ? null : roleKey;
  const isActingHodNavSelected =
    pathname.startsWith(`/dashboard/${roleSlug}/approvals`) &&
    searchParams.get("section") === "acting-hod";

  const navItems =
    isAdminShell && !isGuest
      ? [
          {
            label: "Add Users",
            href: "/dashboard/admin",
            active: pathname === "/dashboard/admin",
          },
          {
            label: "Create Form",
            href: "/dashboard/admin/form-builder",
            active: pathname.startsWith("/dashboard/admin/form-builder"),
          },
          {
            label: "Forms",
            href: "/dashboard/admin/forms",
            active: pathname.startsWith("/dashboard/admin/forms"),
          },
          {
            label: "Audit",
            href: "/dashboard/admin/audit",
            active: pathname.startsWith("/dashboard/admin/audit"),
          },
          {
            label: "Statistics",
            href: "/dashboard/admin/statistics",
            active: pathname.startsWith("/dashboard/admin/statistics"),
          },
          {
            label: "Track Applications",
            href: "/dashboard/admin/track",
            active: pathname.startsWith("/dashboard/admin/track"),
          },
        ]
      : [
          {
            label: "Leaves",
            href: `/dashboard/${roleSlug}/leaves`,
            active: leavesActive,
          },
          {
            label: "Forms",
            href: "/dashboard/forms",
            active: pathname.startsWith("/dashboard/forms"),
          },
          {
            label: "My Applications",
            href: `/dashboard/${roleSlug}/my-applications`,
            active: pathname.startsWith(
              `/dashboard/${roleSlug}/my-applications`,
            ),
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

  /** Handle nav click — for guests, protected items trigger login prompt */
  const handleNavClick = (e: React.MouseEvent, label: string) => {
    if (isGuest && GUEST_PROTECTED_LABELS.has(label)) {
      e.preventDefault();
      promptLogin(
        `Sign in to access ${label}. This section requires an authenticated session.`,
      );
    }
  };

  return (
    <div className="min-h-screen">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-3 py-2 sm:px-6 sm:py-3">
          <div className="sm:hidden space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="px-2.5 py-2"
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
                  className="h-10 w-10 object-contain"
                  priority
                />
              </div>

              <div className="flex items-center gap-2">
                <GuideButton />
                {isGuest ? (
                  <Button
                    asChild
                    variant="primary"
                    className="px-3 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm"
                  >
                    <Link href="/login" className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" /> Sign In
                    </Link>
                  </Button>
                ) : (
                  <DashboardLogoutButton />
                )}
              </div>
            </div>

            <div className="pl-11 text-[11px] font-semibold leading-tight tracking-normal text-slate-500">
              {isGuest
                ? "Exploring as Guest"
                : userName
                  ? `Welcome, ${userName}`
                  : "Leave Workspace"}
              {!isGuest && userRole ? ` (${userRole})` : ""}
            </div>
          </div>

          <div className="hidden items-center justify-between gap-3 sm:flex">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src="/iit_ropar.png"
                alt="IIT Ropar Logo"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                priority
              />

              <div className="min-w-0 space-y-2">
                <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {isGuest
                    ? "Guest"
                    : userName
                      ? `Welcome, ${userName}`
                      : "Leave Workspace"}
                  {!isGuest && userRole ? ` (${userRole})` : ""}
                </div>

                <nav className="flex flex-1 flex-wrap items-center gap-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.label)}
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

            <div className="flex items-center gap-2">
              <GuideButton />
              {isGuest ? (
                <Button
                  asChild
                  variant="primary"
                  className="px-3 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm"
                >
                  <Link href="/login" className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" /> Sign In
                  </Link>
                </Button>
              ) : (
                <DashboardLogoutButton />
              )}
            </div>
          </div>
        </div>

        {/* Guest info banner */}
        {isGuest && (
          <div className="border-t border-slate-100 bg-slate-50/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-1.5 sm:px-6">
              <p className="text-xs text-slate-500">
                You&apos;re exploring as a guest. Sign in for full access.
              </p>
            </div>
          </div>
        )}
      </header>

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
            className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white border-r border-slate-200 shadow-sm"
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
            <nav className="flex-1 overflow-y-auto p-3 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    handleNavClick(e, item.label);
                    if (!(isGuest && GUEST_PROTECTED_LABELS.has(item.label))) {
                      setMobileNavOpen(false);
                    }
                  }}
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
            <div className="border-t border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {isGuest ? "Browsing as" : "Signed in as"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {isGuest ? "Guest" : (userName ?? "IIT Ropar User")}
              </p>
              {!isGuest && userRole ? (
                <p className="text-xs text-slate-500">{userRole}</p>
              ) : null}
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <GuideButton />
                  {isGuest ? (
                    <Button
                      asChild
                      variant="primary"
                      className="px-3 py-2 text-xs"
                    >
                      <Link href="/login" className="flex items-center gap-2">
                        <LogIn className="h-3.5 w-3.5" /> Sign In
                      </Link>
                    </Button>
                  ) : (
                    <DashboardLogoutButton />
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <main
        className={cn(
          "mx-auto w-full max-w-6xl px-3 pb-10 sm:px-6",
          isGuest ? "pt-28 sm:pt-32" : "pt-24 sm:pt-28",
        )}
      >
        {children}
      </main>
    </div>
  );
};
