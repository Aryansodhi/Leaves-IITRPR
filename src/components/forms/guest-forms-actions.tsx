"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { useGuest } from "@/components/auth/guest-context";
import { Button } from "@/components/ui/button";

export const GuestFormsActions = ({ isGuest }: { isGuest: boolean }) => {
  const { promptLogin } = useGuest();

  if (!isGuest) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href="/dashboard/forms/submissions">My submissions</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard/forms/approvals">Approvals inbox</Link>
        </Button>
        <Button asChild>
          <Link
            href="/dashboard/forms/create"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Create a Form
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        onClick={() =>
          promptLogin(
            "Sign in to view your submissions. This section requires an authenticated session.",
          )
        }
      >
        My submissions
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          promptLogin(
            "Sign in to access the approvals inbox. This section requires an authenticated session.",
          )
        }
      >
        Approvals inbox
      </Button>
      <Button asChild>
        <Link
          href="/dashboard/forms/create"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Create a Form
        </Link>
      </Button>
    </div>
  );
};
