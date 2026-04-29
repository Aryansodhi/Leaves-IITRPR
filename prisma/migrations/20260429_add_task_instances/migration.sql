-- Add per-user task instances for form workflow assignments.

CREATE TYPE "TaskInstanceStatus" AS ENUM ('ASSIGNED', 'DONE');

CREATE TABLE "FormTaskInstance" (
  "id" text PRIMARY KEY,
  "templateId" text NOT NULL,
  "taskId" text NOT NULL,
  "assignedToId" text NOT NULL,
  "status" "TaskInstanceStatus" NOT NULL DEFAULT 'ASSIGNED',
  "actedAt" timestamptz,
  "metadata" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "FormTaskInstance_templateId_taskId_idx" ON "FormTaskInstance"("templateId", "taskId");
CREATE INDEX "FormTaskInstance_assignedToId_status_idx" ON "FormTaskInstance"("assignedToId", "status");

ALTER TABLE "FormTaskInstance" ADD CONSTRAINT "FormTaskInstance_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FormTaskInstance" ADD CONSTRAINT "FormTaskInstance_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
