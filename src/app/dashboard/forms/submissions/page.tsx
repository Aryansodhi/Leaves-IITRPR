import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireSignedInForPage } from "@/server/auth/page-access";
import { prisma } from "@/server/db/prisma";

type SubmissionPayload = {
  workflow?: {
    status?: "PENDING" | "APPROVED";
    currentTaskIndex?: number | null;
    tasks?: Array<{
      title: string;
      type: "fillform" | "signature";
      status: "PENDING" | "IN_PROGRESS" | "DONE";
      assigneeIds?: string[];
      completedById?: string | null;
      completedAt?: string | null;
    }>;
  };
};

const parseSubmissionData = (value: unknown): SubmissionPayload => {
  if (!value || typeof value !== "object") return {};
  return value as SubmissionPayload;
};

const formatDate = (value: Date) =>
  value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default async function FormSubmissionsPage() {
  const actor = await requireSignedInForPage();

  const submissions = await prisma.formSubmission.findMany({
    where: { submittedById: actor.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      data: true,
      template: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  });

  const items = submissions.map((submission) => {
    const payload = parseSubmissionData(submission.data);
    const workflow = payload.workflow;
    const currentTask =
      workflow?.currentTaskIndex != null
        ? (workflow.tasks?.[workflow.currentTaskIndex] ?? null)
        : null;
    const completedSteps =
      workflow?.tasks?.filter((task) => task.status === "DONE").length ?? 0;
    const totalSteps = workflow?.tasks?.length ?? 0;
    const status = workflow?.status ?? "SUBMITTED";

    return {
      id: submission.id,
      templateName: submission.template.name,
      templateDescription: submission.template.description,
      submittedAt: submission.createdAt,
      status,
      currentTaskTitle: currentTask?.title ?? null,
      currentAssigneeCount: currentTask?.assigneeIds?.length ?? 0,
      completedSteps,
      totalSteps,
    };
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                My form submissions
              </h1>
              <p className="text-base text-slate-600">
                Track manual form-builder requests submitted by you.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href="/dashboard/forms">Available forms</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard/forms/approvals">Approvals inbox</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-4">
          {items.length === 0 ? (
            <SurfaceCard className="border-slate-200/80 p-4">
              <p className="text-sm text-slate-600">
                You have not submitted any manual forms yet.
              </p>
            </SurfaceCard>
          ) : (
            items.map((item) => {
              const isApproved = item.status === "APPROVED";
              const isWorkflowPending = item.status === "PENDING";

              return (
                <SurfaceCard
                  key={item.id}
                  className="flex flex-col gap-4 border-slate-200/80 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-slate-900">
                        {item.templateName}
                      </p>
                      {item.templateDescription ? (
                        <p className="text-sm text-slate-600">
                          {item.templateDescription}
                        </p>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        Submitted {formatDate(item.submittedAt)}
                      </p>
                    </div>

                    <StatusPill
                      label={
                        isApproved
                          ? "Approved"
                          : isWorkflowPending
                            ? "Pending"
                            : "Submitted"
                      }
                      tone={
                        isApproved
                          ? "approved"
                          : isWorkflowPending
                            ? "review"
                            : "submitted"
                      }
                    />
                  </div>

                  {item.totalSteps > 0 ? (
                    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Progress
                        </p>
                        <p className="text-sm text-slate-800">
                          {item.completedSteps} of {item.totalSteps} steps done
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Current step
                        </p>
                        <p className="text-sm text-slate-800">
                          {item.currentTaskTitle ?? "No active step"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Waiting on
                        </p>
                        <p className="text-sm text-slate-800">
                          {item.currentTaskTitle
                            ? `${item.currentAssigneeCount} assignee${
                                item.currentAssigneeCount === 1 ? "" : "s"
                              }`
                            : "Completed"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      This form was submitted without a workflow.
                    </p>
                  )}

                  <div className="flex justify-end">
                    <Button asChild variant="secondary">
                      <Link href={`/dashboard/forms/submissions/${item.id}`}>
                        View form
                      </Link>
                    </Button>
                  </div>
                </SurfaceCard>
              );
            })
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
