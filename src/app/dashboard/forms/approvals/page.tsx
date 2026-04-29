import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
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

export default async function FormsApprovalsPage() {
  const actor = await requireSignedInForPage();

  const submissions = await prisma.formSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      templateId: true,
      submittedBy: { select: { name: true, email: true } },
      template: { select: { name: true } },
      data: true,
    },
  });

  const pendingItems = submissions
    .map((entry) => {
      const payload = parseSubmissionData(entry.data);
      const workflow = payload.workflow;
      if (!workflow || workflow.status !== "PENDING") return null;

      const currentTask =
        workflow.currentTaskIndex != null
          ? workflow.tasks?.[workflow.currentTaskIndex]
          : null;

      const canAct = Boolean(currentTask?.assigneeIds.includes(actor.userId));
      if (!canAct) return null;

      return {
        id: entry.id,
        createdAt: entry.createdAt,
        templateId: entry.templateId,
        templateName: entry.template?.name ?? "Untitled form",
        submittedBy: entry.submittedBy,
        currentTaskTitle: currentTask?.title ?? "Pending task",
        currentTaskType: currentTask?.type ?? "fillform",
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Approve forms
              </h1>
              <p className="text-base text-slate-600">
                Review the forms and tasks currently waiting on your next
                workflow step.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href="/dashboard/forms">Available forms</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard/forms/submissions">My submissions</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-4">
          {pendingItems.length === 0 ? (
            <SurfaceCard className="border-slate-200/80 p-4">
              <p className="text-sm text-slate-600">
                No workflow items are pending for you right now.
              </p>
            </SurfaceCard>
          ) : (
            pendingItems.map((item) => (
              <SurfaceCard
                key={item.id}
                className="flex flex-col gap-3 border-slate-200/80 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-base font-semibold text-slate-900">
                    {item.templateName}
                  </p>
                  <p className="text-sm text-slate-600">
                    Current step: {item.currentTaskTitle}
                  </p>
                  <p className="text-xs text-slate-500">
                    Submitted by{" "}
                    {item.submittedBy?.name ??
                      item.submittedBy?.email ??
                      "Unknown user"}
                  </p>
                </div>

                <Button asChild>
                  <Link href={`/dashboard/forms/approvals/${item.id}`}>
                    Open request
                  </Link>
                </Button>
              </SurfaceCard>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
