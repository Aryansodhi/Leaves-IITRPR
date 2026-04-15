import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Layers3, LogIn, ShieldCheck, Users } from "lucide-react";

import { HomeAuthRedirect } from "@/components/auth/home-auth-redirect";
import { OtpForm } from "@/components/auth/otp-form";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  requireSessionActor,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
import {
  isValidDashboardPath,
  LAST_DASHBOARD_PATH_COOKIE,
} from "@/server/auth/last-dashboard-path";

const highlights = [
  {
    title: "Role-based dashboards",
    body: "Faculty, HoDs, Registrar, Accounts and Director land on their own workspace after sign in.",
    icon: Users,
  },
  {
    title: "OTP-only security",
    body: "No passwords to remember. Every session is checked through institute email OTPs.",
    icon: ShieldCheck,
  },
  {
    title: "End-to-end workflows",
    body: "One place to request earned leave, ex-India visits, LTC, air travel exceptions and more.",
    icon: Layers3,
  },
];

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

  return (
    <div className="space-y-10 sm:space-y-12">
      <HomeAuthRedirect />
      <div className="fixed right-3 top-3 z-30 md:hidden">
        <Button asChild className="px-4 py-2 text-xs">
          <Link href="/login" className="flex items-center gap-2">
            <LogIn className="h-3.5 w-3.5" /> Login
          </Link>
        </Button>
      </div>

      <SurfaceCard className="grid gap-6 bg-gradient-to-br from-white via-white to-slate-50 p-4 sm:gap-8 sm:p-6 lg:gap-10 lg:p-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Sign in to continue to your IIT Ropar leave dashboard.
            </h1>
            <p className="text-sm text-slate-500 sm:text-base">
              Every stakeholder needs to authenticate before viewing approvals
              or raising a request. Use the shared institute email login below;
              once verified we will route you to the dashboard associated with
              your role.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/login" className="flex items-center gap-2">
                <LogIn className="h-4 w-4" /> Log in to Continue
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="#learn-more" className="flex items-center gap-2">
                Learn how it works <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="text-sm text-slate-500">
            Need access? Request it from Establishment & Admin. After
            onboarding, this page will always ask you to log in before showing
            personalised data.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-2 sm:rounded-3xl sm:p-4">
          <OtpForm />
        </div>
      </SurfaceCard>

      <section id="learn-more" className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Before you sign in
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            What to expect after authentication
          </h2>
          <p className="text-sm text-slate-500 sm:text-base">
            Once the OTP is verified we will take you straight to the experience
            configured for your role. These cards outline what each persona can
            do after logging in. More institute-specific information will appear
            here soon.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {highlights.map((highlight) => (
            <SurfaceCard
              key={highlight.title}
              className="h-full space-y-3 border-slate-200/80 p-5"
            >
              <highlight.icon className="h-6 w-6 text-slate-400" />
              <p className="text-lg font-semibold text-slate-900">
                {highlight.title}
              </p>
              <p className="text-sm text-slate-500">{highlight.body}</p>
            </SurfaceCard>
          ))}
        </div>
      </section>
    </div>
  );
}
