"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, ShieldCheck, TimerReset } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/ui/status-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { RoleSlug } from "@/modules/roles";

const OTP_HINT_MINUTES = Number(process.env.NEXT_PUBLIC_OTP_MINUTES ?? 10);

const emailSchema = z.object({
  email: z.string().email("Enter your institute email"),
});

const otpSchema = z.object({
  code: z.string().regex(/^[0-9]{6}$/g, "OTP must contain 6 digits"),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type OtpFormValues = z.infer<typeof otpSchema>;

type Stage = "EMAIL" | "OTP" | "SUCCESS";

type ApiResponse = {
  ok: boolean;
  message?: string;
  role?: RoleSlug;
  redirectTo?: string;
  user?: {
    email: string;
    roleKey: string;
    name?: string;
  };
};

const fetcher = async (url: string, body: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as ApiResponse;

  if (!response.ok) {
    throw new Error(data.message ?? "Something went wrong.");
  }

  return data;
};

export const OtpForm = () => {
  const [stage, setStage] = useState<Stage>("EMAIL");
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  const maskedEmail = useMemo(() => {
    if (!email) return null;
    const [local, domain] = email.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }, [email]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setStatusMessage(error);
    }
  }, []);

  const requestOtp = emailForm.handleSubmit(async (values) => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const result = await fetcher("/api/auth/request-otp", {
        email: values.email,
      });
      setEmail(values.email.toLowerCase());
      setStage("OTP");
      setStatusMessage(result.message ?? "OTP sent. Check your inbox.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to send OTP.",
      );
    } finally {
      setIsLoading(false);
    }
  });

  const verifyOtp = otpForm.handleSubmit(async (values) => {
    if (!email) {
      setStatusMessage("Request a code first.");
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const result = await fetcher("/api/auth/verify-otp", {
        email,
        code: values.code,
      });
      const roleSlug: RoleSlug = result.role ?? "faculty";
      const destination =
        roleSlug === "admin"
          ? "/dashboard/admin"
          : `/dashboard/${roleSlug}/leaves`;

      if (typeof window !== "undefined" && result.user) {
        window.localStorage.setItem("lf-user-email", result.user.email);
        window.localStorage.setItem("lf-user-role", result.user.roleKey);
      }
      setStage("SUCCESS");
      setStatusMessage("Signed in. Redirecting you now...");
      emailForm.reset();
      otpForm.reset();
      setEmail("");
      window.setTimeout(() => {
        window.location.assign(destination);
      }, 200);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not verify the code.",
      );
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <SurfaceCard className="space-y-6 p-4 sm:space-y-8 sm:p-6" spotlight>
      <div className="space-y-3">
        <StatusPill label="Secure Access" tone="review" />
        <div>
          <p className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
            Sign in with Gmail
          </p>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Use your institute Gmail address to receive a one-time passcode.
            OTPs expire in {OTP_HINT_MINUTES} minutes.
          </p>
        </div>
      </div>

      {stage === "EMAIL" && (
        <form className="space-y-4" onSubmit={requestOtp}>
          <div className="space-y-2">
            <Label htmlFor="email">Institute Email</Label>
            <div className="flex items-center gap-2 sm:gap-3">
              <Mail className="h-5 w-5 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="name@iitrpr.ac.in"
                {...emailForm.register("email")}
              />
            </div>
            {emailForm.formState.errors.email && (
              <p className="text-sm text-rose-600">
                {emailForm.formState.errors.email.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending code
              </>
            ) : (
              "Sign in with Gmail"
            )}
          </Button>
        </form>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px w-full bg-slate-200" />
          <span>or</span>
          <span className="h-px w-full bg-slate-200" />
        </div>
        <Button asChild variant="secondary" className="w-full">
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white">
              <svg
                viewBox="0 0 533.5 544.3"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  fill="#4285F4"
                  d="M533.5 278.4c0-18.6-1.7-37.2-5.2-55.3H272v104.7h146.9c-6.3 34-25 62.9-53.3 82.2v68h86.2c50.5-46.5 82.7-115.2 82.7-199.6z"
                />
                <path
                  fill="#34A853"
                  d="M272 544.3c72.6 0 133.6-23.9 178.1-64.6l-86.2-68c-24 16.2-55 25.4-91.9 25.4-70.6 0-130.4-47.6-151.8-111.5H31.7v69.9C76.5 482.7 168.2 544.3 272 544.3z"
                />
                <path
                  fill="#FBBC04"
                  d="M120.2 325.6c-11.2-34-11.2-70.8 0-104.8V151H31.7c-36.4 72.6-36.4 159 0 231.6l88.5-57z"
                />
                <path
                  fill="#EA4335"
                  d="M272 107.7c39.6-.6 77.7 14.6 106.8 42.6l79.6-79.6C408.5 24.1 344.8-1.5 272 0 168.2 0 76.5 61.6 31.7 151l88.5 69.9C141.6 155.3 201.4 107.7 272 107.7z"
                />
              </svg>
            </span>
            <span>Sign in with Google</span>
          </a>
        </Button>
      </div>

      {stage === "OTP" && (
        <form className="space-y-4" onSubmit={verifyOtp}>
          <div className="space-y-2">
            <Label htmlFor="otp">
              Enter the 6-digit code sent to {maskedEmail}
            </Label>
            <div className="flex items-center gap-2 sm:gap-3">
              <ShieldCheck className="h-5 w-5 text-slate-400" />
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                {...otpForm.register("code")}
              />
            </div>
            {otpForm.formState.errors.code && (
              <p className="text-sm text-rose-600">
                {otpForm.formState.errors.code.message}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-slate-900"
              onClick={() => {
                setStage("EMAIL");
                setStatusMessage(null);
                otpForm.reset();
              }}
            >
              <TimerReset className="h-4 w-4" />
              Request new OTP
            </button>
            {maskedEmail && <span>Delivering to {maskedEmail}</span>}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying
              </>
            ) : (
              "Verify & continue"
            )}
          </Button>
        </form>
      )}

      {stage === "SUCCESS" && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-emerald-50 p-5 text-center text-emerald-800">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-lg font-semibold">Signed in</p>
          <p className="text-sm text-emerald-700">
            Redirecting you to your dashboard...
          </p>
        </div>
      )}

      {statusMessage && (
        <p className="text-sm text-slate-600">{statusMessage}</p>
      )}
    </SurfaceCard>
  );
};
