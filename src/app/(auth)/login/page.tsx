import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { OtpForm } from "@/components/auth/otp-form";
import {
  SESSION_COOKIE_NAME,
  requireSessionActor,
} from "@/server/auth/session";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      await requireSessionActor(token);
      redirect("/");
    } catch {}
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-10">
      <div className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          IIT Ropar Leave Cell
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Secure access for faculty & staff
        </h1>
        <p className="text-base text-slate-500">
          Use your institute mailbox to receive a one-time passcode. Unsure
          where to start?{" "}
          <Link className="font-semibold text-slate-900" href="/">
            Read the quick start
          </Link>
        </p>
      </div>
      <OtpForm />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          OTP login is enforced for every session.
        </span>
        <Link className="font-semibold text-slate-900" href="/">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
