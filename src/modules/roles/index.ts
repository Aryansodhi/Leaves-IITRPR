import type { RoleDashboardConfig, RoleSlug } from "./types";
import { accountsDashboard } from "./accounts/config";
import { associateHoDDashboard } from "./associate-hod/config";
import { deanDashboard } from "./dean/config";
import { directorDashboard } from "./director/config";
import { establishmentDashboard } from "./establishment/config";
import { facultyDashboard } from "./faculty/config";
import { hodDashboard } from "./hod/config";
import { registrarDashboard } from "./registrar/config";
import { staffDashboard } from "./staff/config";

const dashboards = {
  faculty: facultyDashboard,
  staff: staffDashboard,
  hod: hodDashboard,
  "associate-hod": associateHoDDashboard,
  dean: deanDashboard,
  registrar: registrarDashboard,
  accounts: accountsDashboard,
  establishment: establishmentDashboard,
  director: directorDashboard,
} satisfies Record<RoleSlug, RoleDashboardConfig>;

export const roleConfigs: Record<RoleSlug, RoleDashboardConfig> = dashboards;
export const roleList = Object.values(roleConfigs);

export * from "./types";
