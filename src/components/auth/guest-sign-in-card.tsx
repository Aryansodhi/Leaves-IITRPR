import Link from "next/link";
import { LogIn, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

export const GuestSignInCard = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <SurfaceCard className="flex flex-col items-center space-y-5 border-slate-200/80 p-8 text-center sm:p-10">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-50">
      <Lock className="h-6 w-6 text-slate-400" />
    </div>
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto max-w-md text-sm text-slate-500 leading-relaxed">
        {description}
      </p>
    </div>
    <Button asChild>
      <Link href="/login" className="flex items-center gap-2">
        <LogIn className="h-4 w-4" /> Sign In to Access
      </Link>
    </Button>
    <p className="text-xs text-slate-400">
      You are currently exploring as a guest.
    </p>
  </SurfaceCard>
);
