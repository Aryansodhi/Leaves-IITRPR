-- Add workflow tracking and step audit for form submissions

ALTER TABLE "FormTemplate"
ADD COLUMN "isPublished" boolean NOT NULL DEFAULT false,
ADD COLUMN "lastPublishedAt" timestamptz;

CREATE INDEX "FormTemplate_isPublished_lastPublishedAt_idx" ON "FormTemplate"("isPublished", "lastPublishedAt");

ALTER TABLE "FormSubmission"
ADD COLUMN "currentWorkflowStepIndex" integer NOT NULL DEFAULT 0,
ADD COLUMN "taskOrderSnapshot" jsonb;

CREATE INDEX "FormSubmission_currentWorkflowStepIndex_idx" ON "FormSubmission"("currentWorkflowStepIndex");

CREATE TABLE "FormSubmissionStepAction" (
  "id" text PRIMARY KEY,
  "submissionId" text NOT NULL,
  "stepIndex" integer NOT NULL,
  "taskId" text NOT NULL,
  "action" text NOT NULL,
  "completedByUserId" text,
  "remarks" text,
  "metadata" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "FormSubmissionStepAction_submissionId_stepIndex_idx" ON "FormSubmissionStepAction"("submissionId", "stepIndex");
CREATE INDEX "FormSubmissionStepAction_completedByUserId_createdAt_idx" ON "FormSubmissionStepAction"("completedByUserId", "createdAt");
CREATE INDEX "FormSubmissionStepAction_taskId_idx" ON "FormSubmissionStepAction"("taskId");

ALTER TABLE "FormSubmissionStepAction" ADD CONSTRAINT "FormSubmissionStepAction_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FormSubmissionStepAction" ADD CONSTRAINT "FormSubmissionStepAction_completedByUserId_fkey"
FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
