"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogIn, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export const GuestLoginModal = ({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message?: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/70 bg-white p-8 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-50">
            <Image
              src="/iit_ropar.png"
              alt="IIT Ropar"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
          </div>

          <h2 className="text-xl font-semibold text-slate-900">
            Sign in to continue
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {message ??
              "This action requires an authenticated session. Please sign in with your institute email to proceed."}
          </p>

          <div className="mt-6 flex w-full flex-col gap-3">
            <Button asChild className="w-full">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2"
              >
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
            </Button>
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Continue Browsing
            </Button>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            You are currently exploring as a guest.
          </p>
        </div>
      </div>
    </div>
  );
};
