"use client";

import { useEffect } from "react";

import { getLastDashboardPath } from "@/components/auth/dashboard-last-route-tracker";

const isSafeDashboardPath = (value: string) => {
  if (!value.startsWith("/dashboard")) return false;
  if (value.startsWith("/dashboard//")) return false;
  return true;
};

export const HomeAuthRedirect = () => {
  useEffect(() => {
    const target = getLastDashboardPath();
    if (!target || !isSafeDashboardPath(target)) return;

    // Only redirect if the current session cookie is valid.
    fetch("/api/profile", { credentials: "include" })
      .then((response) => {
        if (!response.ok) return;
        if (
          window.location.pathname === "/" ||
          window.location.pathname === "/login"
        ) {
          window.location.replace(target);
        }
      })
      .catch(() => {
        // ignore
      });
  }, []);

  return null;
};
