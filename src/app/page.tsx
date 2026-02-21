import Link from "next/link";
import { ArrowRight, Layers3, LogIn, ShieldCheck, Users } from "lucide-react";

import { OtpForm } from "@/components/auth/otp-form";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

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

export default function Home() {
  return (
    <div className="space-y-12">
      <SurfaceCard className="grid gap-10 bg-gradient-to-br from-white via-white to-slate-50 p-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold leading-tight text-slate-900">
              Sign in to continue to your IIT Ropar leave dashboard.
            </h1>
            <p className="text-base text-slate-500">
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

        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-4">
          <OtpForm />
        </div>
      </SurfaceCard>

      <section id="learn-more" className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Before you sign in
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            What to expect after authentication
          </h2>
          <p className="text-base text-slate-500">
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
