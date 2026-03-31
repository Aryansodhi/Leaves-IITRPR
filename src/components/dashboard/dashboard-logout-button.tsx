"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export const DashboardLogoutButton = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    setIsSubmitting(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
      router.refresh();
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      variant="secondary"
      className="px-3 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm"
      onClick={handleLogout}
      disabled={isSubmitting}
      aria-label="Log out"
    >
      <LogOut className="h-4 w-4" />
      {isSubmitting ? "Logging out..." : "Logout"}
    </Button>
  );
};
