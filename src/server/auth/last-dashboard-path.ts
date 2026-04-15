export const LAST_DASHBOARD_PATH_COOKIE = "lf_last_dashboard_path";

export const isValidDashboardPath = (value: string) => {
  if (!value.startsWith("/dashboard")) return false;
  if (value.startsWith("/dashboard//")) return false;
  if (value.includes("\n") || value.includes("\r")) return false;
  return true;
};
