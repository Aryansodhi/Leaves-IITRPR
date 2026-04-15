"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LAST_DASHBOARD_PATH_KEY = "lf-last-dashboard-path";

export const DashboardLastRouteTracker = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname) return;
    if (!pathname.startsWith("/dashboard")) return;

    try {
      window.localStorage.setItem(LAST_DASHBOARD_PATH_KEY, pathname);
    } catch {
      // ignore
    }
  }, [pathname]);

  return null;
};

export const getLastDashboardPath = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_DASHBOARD_PATH_KEY);
  } catch {
    return null;
  }
};
