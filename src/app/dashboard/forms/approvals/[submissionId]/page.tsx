import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TemplateFormRenderer } from "@/components/forms/template-form-renderer";
import type { FormTemplateSchema } from "@/components/forms/template-form-renderer";
import { requireSignedInForPage } from "@/server/auth/page-access";
import { prisma } from "@/server/db/prisma";

type SubmissionPayload = {
  values?: Record<string, string>;
  workflow?: {
    status?: "PENDING" | "APPROVED";
    currentTaskIndex?: number | null;
    tasks?: Array<{
      id: string;
      title: string;
      type: "fillform" | "signature";
      assigneeIds: string[];
      status: "PENDING" | "IN_PROGRESS" | "DONE";
      completedById?: string | null;
    }>;
  };
};

const parseSubmissionData = (value: unknown): SubmissionPayload => {
  if (!value || typeof value !== "object") return {};
  return value as SubmissionPayload;
};

type PageProps = {
  params: Promise<{ submissionId: string }>;
};

export default async function SubmissionApprovalPage({ params }: PageProps) {
  const actor = await requireSignedInForPage();
  const { submissionId } = await params;

  if (!submissionId) {
    notFound();
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      createdAt: true,
      submittedBy: { select: { name: true, email: true } },
      template: {
        select: { id: true, name: true, description: true, schema: true },
      },
      data: true,
    },
  });

  if (!submission) {
    notFound();
  }

  const schema = submission.template.schema as unknown as FormTemplateSchema;
  const payload = parseSubmissionData(submission.data);
  const workflow = payload.workflow;
  const currentTask =
    workflow?.currentTaskIndex != null
      ? (workflow.tasks?.[workflow.currentTaskIndex] ?? null)
      : null;
  const canAct = Boolean(currentTask?.assigneeIds.includes(actor.userId));

  if (!workflow || workflow.status !== "PENDING" || !canAct) {
    return (
      <DashboardShell>
        <SurfaceCard className="border-slate-200/80 p-6">
          <p className="text-sm font-semibold text-slate-700">
            This request is not currently assigned to you.
          </p>
        </SurfaceCard>
      </DashboardShell>
    );
  }

  const title = schema.title || submission.template.name;
  const description =
    schema.description ?? submission.template.description ?? null;

  const pendingItem = {
    id: submission.id,
    createdAt: submission.createdAt.toISOString(),
    status: workflow.status,
    currentTaskIndex: workflow.currentTaskIndex ?? null,
    currentTaskTitle: currentTask?.title ?? null,
    currentTaskType: currentTask?.type ?? null,
    canAct: true,
    submittedBy: submission.submittedBy,
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="text-base text-slate-600">{description}</p>
          ) : null}
          <p className="text-sm text-slate-500">
            Submitted by{" "}
            {submission.submittedBy?.name ??
              submission.submittedBy?.email ??
              "Unknown user"}
          </p>
        </header>

        <TemplateFormRenderer
          templateId={submission.template.id}
          schema={schema}
          userEmail={actor.email}
          initialValues={payload.values ?? {}}
          workflowContext={{
            items: [pendingItem],
            pendingForActor: pendingItem,
          }}
        />
      </div>
    </DashboardShell>
  );
}
