import { RoleKey } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

export type TaskAssignmentMode =
  | "specific"
  | "role"
  | "department"
  | "sameDepartmentRole"
  | "all";

export type TaskAssignment = {
  mode: TaskAssignmentMode;
  values: string[];
};

export type TaskRoutingRule = {
  id: string;
  sourceRoles: RoleKey[];
  assignment: TaskAssignment;
};

export type WorkflowTaskRoutingInput = {
  assignment?: TaskAssignment | null;
  routes?: TaskRoutingRule[] | null;
};

export type WorkflowActorContext = {
  roleKey: RoleKey;
  departmentId?: string | null;
};

const normalizeAssignment = (
  assignment?: TaskAssignment | null,
): TaskAssignment => ({
  mode: assignment?.mode ?? "all",
  values: (assignment?.values ?? []).filter((value) => value.trim().length > 0),
});

const getActiveUserIds = async (where: Prisma.UserWhereInput) => {
  const users = await prisma.user.findMany({
    where,
    select: { id: true },
  });

  return users.map((user) => user.id);
};

const resolveAssignmentTarget = async (
  assignment: TaskAssignment,
  actor: WorkflowActorContext,
) => {
  const values = assignment.values.filter((value) => value.trim().length > 0);

  if (assignment.mode === "specific") {
    return values;
  }

  if (assignment.mode === "all") {
    return getActiveUserIds({ isActive: true });
  }

  if (assignment.mode === "role") {
    return getActiveUserIds({
      isActive: true,
      role: {
        key: {
          in: values as RoleKey[],
        },
      },
    });
  }

  if (assignment.mode === "department") {
    return getActiveUserIds({
      isActive: true,
      departmentId: {
        in: values,
      },
    });
  }

  if (assignment.mode === "sameDepartmentRole") {
    if (!actor.departmentId || values.length === 0) return [];

    return getActiveUserIds({
      isActive: true,
      departmentId: actor.departmentId,
      role: {
        key: {
          in: values as RoleKey[],
        },
      },
    });
  }

  return [];
};

export const resolveTaskAssignees = async (
  task: WorkflowTaskRoutingInput,
  actor: WorkflowActorContext,
) => {
  const routingRule =
    task.routes?.find((rule) => rule.sourceRoles.includes(actor.roleKey)) ??
    null;
  const assignment = normalizeAssignment(
    routingRule?.assignment ?? task.assignment,
  );
  return resolveAssignmentTarget(assignment, actor);
};
