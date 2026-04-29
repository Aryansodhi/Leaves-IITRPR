import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TemplateFormRenderer } from "@/components/forms/template-form-renderer";
import type { FormTemplateSchema } from "@/components/forms/template-form-renderer";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireSignedInForPage } from "@/server/auth/page-access";
import { prisma } from "@/server/db/prisma";

type WorkflowStatus = "PENDING" | "APPROVED";

type SubmissionPayload = {
  values?: Record<string, string>;
  workflow?: {
    status?: WorkflowStatus;
    currentTaskIndex?: number | null;
    tasks?: Array<{
      id: string;
      title: string;
      type: "fillform" | "signature";
      assigneeIds: string[];
      status: "PENDING" | "IN_PROGRESS" | "DONE";
      completedById?: string | null;
      completedAt?: string | null;
    }>;
  };
};

type PageProps = {
  params: Promise<{ submissionId: string }>;
};

const parseSubmissionData = (value: unknown): SubmissionPayload => {
  if (!value || typeof value !== "object") return {};
  return value as SubmissionPayload;
};

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const getTaskTone = (
  status: "PENDING" | "IN_PROGRESS" | "DONE",
): "approved" | "review" | "submitted" => {
  if (status === "DONE") return "approved";
  if (status === "IN_PROGRESS") return "review";
  return "submitted";
};

export default async function FormSubmissionDetailsPage({ params }: PageProps) {
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
      submittedById: true,
      submittedBy: { select: { name: true, email: true } },
      template: {
        select: { id: true, name: true, description: true, schema: true },
      },
      data: true,
    },
  });

  if (!submission || submission.submittedById !== actor.userId) {
    notFound();
  }

  const schema = submission.template.schema as unknown as FormTemplateSchema;
  const payload = parseSubmissionData(submission.data);
  const workflow = payload.workflow;
  const workflowStatus: WorkflowStatus = workflow?.status ?? "APPROVED";

  const completedByIds = Array.from(
    new Set(
      (workflow?.tasks ?? [])
        .map((task) => task.completedById)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const completedByUsers = completedByIds.length
    ? await prisma.user.findMany({
        where: { id: { in: completedByIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const completedByNameById = new Map(
    completedByUsers.map((user) => [
      user.id,
      user.name || user.email || "Unknown user",
    ]),
  );

  const title = schema.title || submission.template.name;
  const description =
    schema.description ?? submission.template.description ?? null;
  const statusLabel = workflow
    ? workflowStatus === "APPROVED"
      ? "Approved"
      : "Pending"
    : "Submitted";
  const statusTone = workflow
    ? workflowStatus === "APPROVED"
      ? "approved"
      : "review"
    : "submitted";
  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="text-base text-slate-600">{description}</p>
              ) : null}
              <p className="text-sm text-slate-500">
                Submitted {formatDate(submission.createdAt)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill label={statusLabel} tone={statusTone} />
              <Button asChild variant="secondary">
                <Link href="/dashboard/forms/submissions">Back</Link>
              </Button>
            </div>
          </div>
        </header>

        <SurfaceCard className="space-y-3 border-slate-200/80 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-slate-900">
              Audit trail
            </p>
            <p className="text-xs text-slate-500">
              Submitted by{" "}
              {submission.submittedBy?.name ??
                submission.submittedBy?.email ??
                "you"}
              .
            </p>
          </div>

          {workflow?.tasks?.length ? (
            <div className="space-y-2">
              {workflow.tasks.map((task, index) => (
                <div
                  key={task.id}
                  className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[1fr_auto]"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {index + 1}. {task.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {task.type === "fillform"
                        ? "Form completion"
                        : "Digital signature"}
                    </p>
                    {task.completedById ? (
                      <p className="text-xs text-slate-600">
                        Completed by{" "}
                        {completedByNameById.get(task.completedById) ??
                          "Unknown user"}
                        {task.completedAt
                          ? ` on ${formatDate(task.completedAt)}`
                          : ""}
                      </p>
                    ) : task.status === "IN_PROGRESS" ? (
                      <p className="text-xs text-slate-600">
                        Waiting on {task.assigneeIds.length} assignee
                        {task.assigneeIds.length === 1 ? "" : "s"}.
                      </p>
                    ) : null}
                  </div>
                  <div className="sm:text-right">
                    <StatusPill
                      label={task.status}
                      tone={getTaskTone(task.status)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              This form was submitted without a workflow.
            </p>
          )}
        </SurfaceCard>

        <TemplateFormRenderer
          templateId={submission.template.id}
          schema={schema}
          userEmail={actor.email}
          initialValues={payload.values ?? {}}
          readOnly
          workflowContext={{
            items: [],
            pendingForActor: null,
          }}
        />
      </div>
    </DashboardShell>
  );
}
