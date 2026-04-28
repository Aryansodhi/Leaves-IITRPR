"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";
import {
  DIGITAL_SIGNATURE_VALUE,
  useSignatureOtp,
} from "@/components/leaves/use-signature-otp";
import { SignatureOtpVerificationCard } from "@/components/leaves/signature-otp-verification-card";

type FieldLayout = {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

type FieldWidth = "short" | "medium" | "long" | "full";

type BrandField = {
  id: string;
  kind: "brand";
  collegeName: string;
  formHeading: string;
  showLogo: boolean;
  layout: FieldLayout;
};

type TextField = {
  id: string;
  kind: "text";
  content: string;
  alignment: "left" | "center" | "right";
  rows: number;
  width: FieldWidth;
  layout: FieldLayout;
};

type InputField = {
  id: string;
  kind: "input";
  label: string;
  inputType: "text" | "email" | "tel" | "date" | "number";
  required: boolean;
  minLength?: number | null;
  maxLength?: number | null;
  helpText?: string | null;
  width: FieldWidth;
  layout: FieldLayout;
};

type TextAreaField = {
  id: string;
  kind: "textarea";
  label: string;
  value: string;
  required: boolean;
  minLength?: number | null;
  maxLength?: number | null;
  helpText?: string | null;
  rows: number;
  width: FieldWidth;
  layout: FieldLayout;
};

type CheckboxField = {
  id: string;
  kind: "checkbox";
  label: string;
  defaultChecked: boolean;
  width: FieldWidth;
  layout: FieldLayout;
};

type SignatureField = {
  id: string;
  kind: "signature";
  label?: string;
  required?: boolean;
  layout: FieldLayout;
};

type BuilderField =
  | BrandField
  | TextField
  | InputField
  | TextAreaField
  | CheckboxField
  | SignatureField;

type BuilderPage = {
  id: string;
  title: string | null;
  fields: BuilderField[];
};

type WorkflowTask = {
  id: string;
  title: string;
  type: "fillform" | "signature";
  formTemplateId?: string | null;
  assignment: {
    mode: "specific" | "role" | "department" | "all";
    values: string[];
  };
};

type WorkflowSubmissionItem = {
  id: string;
  createdAt: string;
  status: "PENDING" | "APPROVED";
  currentTaskIndex: number | null;
  currentTaskTitle: string | null;
  currentTaskType: "fillform" | "signature" | null;
  canAct: boolean;
  submittedBy?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

export type FormTemplateSchema = {
  version?: number;
  title?: string;
  description?: string | null;
  visibilityRoles?: string[];
  lifecycle?: {
    status?: "draft" | "published";
  };
  grid?: {
    unit?: number;
    unitLabel?: string;
    columns?: number;
    rows?: number;
  };
  pages?: BuilderPage[];
  tasks?: WorkflowTask[];
};

type TemplateFormRendererProps = {
  templateId: string;
  schema: FormTemplateSchema;
};

const DEFAULT_GRID = {
  unit: 6,
  columns: 30,
  rows: 45,
};

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;

const isNonEmpty = (value?: string) =>
  Boolean(value && value.trim().length > 0);

const getTaskAssignmentSummary = (task: WorkflowTask) => {
  const count = task.assignment.values.length;
  if (task.assignment.mode === "all") return "All eligible users";
  if (task.assignment.mode === "role") {
    return count > 0
      ? `${count} selected role${count === 1 ? "" : "s"}`
      : "Selected roles";
  }
  if (task.assignment.mode === "department") {
    return count > 0
      ? `${count} selected department${count === 1 ? "" : "s"}`
      : "Selected departments";
  }
  return count > 0
    ? `${count} selected user${count === 1 ? "" : "s"}`
    : "Selected users";
};

const FormSignatureField = ({
  fieldId,
  label,
  required,
  value,
  onChange,
}: {
  fieldId: string;
  label?: string;
  required?: boolean;
  value: string;
  onChange: (nextValue: string) => void;
}) => {
  const signature = useSignatureOtp({ enableTyped: true });

  useEffect(() => {
    if (
      signature.signatureMode === "typed" &&
      signature.typedSignature.trim() &&
      !signature.signatureCapture &&
      !signature.isOtpVerified
    ) {
      onChange(signature.typedSignature.trim());
      return;
    }

    if (signature.signatureCapture && signature.isOtpVerified) {
      onChange(DIGITAL_SIGNATURE_VALUE);
      return;
    }

    onChange("");
  }, [
    onChange,
    signature.isOtpVerified,
    signature.signatureCapture,
    signature.signatureMode,
    signature.typedSignature,
  ]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-700">
            {label || "Signature"}
            {required ? " *" : ""}
          </Label>
          <p className="text-[10px] text-slate-500">
            Choose a digital signature mode used in leave forms.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {value ? "Captured" : "Pending"}
        </span>
      </div>

      <SignatureOtpVerificationCard
        storageScope={fieldId}
        signatureMode={signature.signatureMode}
        onSignatureModeChange={signature.onSignatureModeChange}
        typedSignature={signature.typedSignature}
        onTypedSignatureChange={signature.onTypedSignatureChange}
        otpEmail={signature.otpEmail}
        otpCode={signature.otpCode}
        onOtpCodeChange={signature.setOtpCode}
        otpStatusMessage={signature.otpStatusMessage}
        isSendingOtp={signature.isSendingOtp}
        isVerifyingOtp={signature.isVerifyingOtp}
        isSubmitting={false}
        onSendOtp={signature.handleSendOtp}
        onVerifyOtp={signature.handleVerifyOtp}
        onSignatureChange={signature.onSignatureChange}
        isOtpVerified={signature.isOtpVerified}
      />
    </div>
  );
};

export const TemplateFormRenderer = ({
  templateId,
  schema,
}: TemplateFormRendererProps) => {
  const pages = useMemo(() => schema.pages ?? [], [schema.pages]);
  const signatureFields = useMemo(
    () =>
      pages.flatMap((page) =>
        page.fields.filter((field) => field.kind === "signature"),
      ),
    [pages],
  );
  const gridUnit = schema.grid?.unit ?? DEFAULT_GRID.unit;
  const gridColumns = schema.grid?.columns ?? DEFAULT_GRID.columns;
  const gridRows = schema.grid?.rows ?? DEFAULT_GRID.rows;
  const gridWidthMm = gridColumns * gridUnit;
  const gridHeightMm = gridRows * gridUnit;
  const pageHorizontalMarginMm = (PAGE_WIDTH_MM - gridWidthMm) / 2;
  const pageVerticalMarginMm = (PAGE_HEIGHT_MM - gridHeightMm) / 2;
  const cellLineHeight = `${gridUnit}mm`;

  const initialValues = useMemo(() => {
    const values: Record<string, string> = {};
    pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (field.kind === "checkbox") {
          values[field.id] = field.defaultChecked ? "true" : "false";
        }
        if (field.kind === "textarea") {
          values[field.id] = field.value ?? "";
        }
        if (field.kind === "input") {
          values[field.id] = "";
        }
      });
    });
    return values;
  }, [pages]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [workflowItems, setWorkflowItems] = useState<WorkflowSubmissionItem[]>(
    [],
  );
  const [pendingForActor, setPendingForActor] =
    useState<WorkflowSubmissionItem | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitTone, setSubmitTone] = useState<"success" | "error" | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasWorkflow = (schema.tasks?.length ?? 0) > 0;

  const updateValue = useCallback((fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const loadWorkflow = useCallback(async () => {
    if (!hasWorkflow) return null;
    try {
      const response = await fetch(
        `/api/forms/submissions?templateId=${encodeURIComponent(templateId)}`,
      );
      const result = (await response.json()) as {
        ok?: boolean;
        data?: {
          items?: WorkflowSubmissionItem[];
          pendingForActor?: WorkflowSubmissionItem | null;
        };
      };
      if (!response.ok || !result.ok) return null;
      return {
        items: result.data?.items ?? [],
        pendingForActor: result.data?.pendingForActor ?? null,
      };
    } catch {
      // Keep form usable if workflow status lookup fails.
      return null;
    }
  }, [hasWorkflow, templateId]);

  useEffect(() => {
    let cancelled = false;

    const hydrateWorkflow = async () => {
      const workflow = await loadWorkflow();
      if (cancelled || !workflow) return;
      setWorkflowItems(workflow.items);
      setPendingForActor(workflow.pendingForActor);
    };

    void hydrateWorkflow();

    return () => {
      cancelled = true;
    };
  }, [loadWorkflow]);

  const handleSubmit = async () => {
    setSubmitMessage(null);
    setSubmitTone(null);

    const missing = pages
      .flatMap((page) => page.fields)
      .filter(
        (field) =>
          (field.kind === "input" ||
            field.kind === "textarea" ||
            field.kind === "signature") &&
          field.required &&
          !isNonEmpty(values[field.id]),
      );

    if (missing.length > 0) {
      setSubmitTone("error");
      setSubmitMessage("Please fill all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const workflowAction = hasWorkflow
        ? pendingForActor
          ? "COMPLETE_TASK"
          : "SUBMIT"
        : "SUBMIT";

      const response = await fetch("/api/forms/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          data: values,
          action: workflowAction,
          submissionId: pendingForActor?.id,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to submit the form.");
      }

      setSubmitTone("success");
      setSubmitMessage(result.message ?? "Form submitted successfully.");
      const workflow = await loadWorkflow();
      if (workflow) {
        setWorkflowItems(workflow.items);
        setPendingForActor(workflow.pendingForActor);
      }
    } catch (error) {
      setSubmitTone("error");
      setSubmitMessage(
        error instanceof Error ? error.message : "Unable to submit the form.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSignatureTask = async () => {
    if (!pendingForActor) return;
    setSubmitMessage(null);
    setSubmitTone(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/forms/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          action: "COMPLETE_TASK",
          submissionId: pendingForActor.id,
          data: {},
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to complete task.");
      }
      setSubmitTone("success");
      setSubmitMessage(result.message ?? "Task completed.");
      const workflow = await loadWorkflow();
      if (workflow) {
        setWorkflowItems(workflow.items);
        setPendingForActor(workflow.pendingForActor);
      }
    } catch (error) {
      setSubmitTone("error");
      setSubmitMessage(
        error instanceof Error ? error.message : "Unable to complete task.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const showFormCanvas =
    !hasWorkflow ||
    pendingForActor?.currentTaskType === "fillform" ||
    !pendingForActor;

  const workflowRoadmap = useMemo(
    () =>
      (schema.tasks ?? []).map((task, index) => ({
        ...task,
        index,
        isCurrent: pendingForActor?.currentTaskIndex === index,
      })),
    [pendingForActor?.currentTaskIndex, schema.tasks],
  );

  const canActOnCurrentTask = Boolean(pendingForActor?.canAct);
  const shouldShowWorkflowTaskDetails =
    hasWorkflow && (canActOnCurrentTask || workflowItems.length === 0);
  const showCompleteTaskButton =
    hasWorkflow &&
    pendingForActor?.currentTaskType === "signature" &&
    canActOnCurrentTask;

  if (!pages.length) {
    return (
      <SurfaceCard className="border-slate-200/80 p-6">
        <p className="text-sm text-slate-600">
          This template does not contain any pages.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-6">
      {showFormCanvas
        ? pages.map((page, pageIndex) => (
            <SurfaceCard key={page.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  {page.title ?? `Page ${pageIndex + 1}`}
                </p>
              </div>

              <div
                className="mx-auto w-[210mm] min-h-[297mm] rounded-lg border border-slate-300 bg-white shadow-sm"
                style={{
                  padding: `${pageVerticalMarginMm}mm ${pageHorizontalMarginMm}mm`,
                  width: `${PAGE_WIDTH_MM}mm`,
                  minHeight: `${PAGE_HEIGHT_MM}mm`,
                }}
              >
                <div
                  className="relative grid"
                  style={{
                    gridTemplateColumns: `repeat(${gridColumns}, ${gridUnit}mm)`,
                    gridAutoRows: `${gridUnit}mm`,
                    width: `${gridWidthMm}mm`,
                    height: `${gridHeightMm}mm`,
                  }}
                >
                  {page.fields.map((field) => (
                    <div
                      key={field.id}
                      className="relative"
                      style={{
                        gridColumn: `${field.layout.col} / span ${field.layout.colSpan}`,
                        gridRow: `${field.layout.row} / span ${field.layout.rowSpan}`,
                      }}
                    >
                      {field.kind === "brand" ? (
                        <div className="flex h-full w-full flex-col items-center justify-center px-2 text-center">
                          {field.showLogo ? (
                            <Image
                              src="/iit_ropar.png"
                              alt="IIT Ropar"
                              width={64}
                              height={64}
                              className="h-14 w-14 object-contain"
                              priority
                            />
                          ) : null}
                          <p
                            className="mt-2 text-[12px] font-semibold text-slate-900"
                            style={{ lineHeight: cellLineHeight }}
                          >
                            {field.collegeName}
                          </p>
                          <p
                            className="mt-1 text-[12px] font-semibold text-slate-900"
                            style={{ lineHeight: cellLineHeight }}
                          >
                            {field.formHeading || schema.title || ""}
                          </p>
                        </div>
                      ) : null}

                      {field.kind === "text" ? (
                        <div
                          className={cn(
                            "h-full w-full whitespace-pre-wrap text-[12px] text-slate-900",
                            field.alignment === "center"
                              ? "text-center"
                              : field.alignment === "right"
                                ? "text-right"
                                : "text-left",
                          )}
                          style={{ lineHeight: cellLineHeight }}
                        >
                          {field.content}
                        </div>
                      ) : null}

                      {field.kind === "input" ? (
                        <div className="flex h-full w-full flex-col justify-center gap-1">
                          {field.label ? (
                            <Label className="text-[11px] text-slate-700">
                              {field.label}
                              {field.required ? " *" : ""}
                            </Label>
                          ) : null}
                          <input
                            type={field.inputType}
                            value={values[field.id] ?? ""}
                            onChange={(event) =>
                              updateValue(field.id, event.target.value)
                            }
                            placeholder={
                              field.inputType === "date"
                                ? "DD/MM/YYYY"
                                : undefined
                            }
                            className="w-full border-0 border-b border-dashed border-slate-400 bg-transparent px-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
                            style={{ lineHeight: cellLineHeight }}
                          />
                          {field.helpText ? (
                            <p className="text-[10px] text-slate-500">
                              {field.helpText}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {field.kind === "textarea" ? (
                        <div className="flex h-full w-full flex-col gap-1">
                          {field.label ? (
                            <Label className="text-[11px] text-slate-700">
                              {field.label}
                              {field.required ? " *" : ""}
                            </Label>
                          ) : null}
                          <textarea
                            value={values[field.id] ?? ""}
                            onChange={(event) =>
                              updateValue(field.id, event.target.value)
                            }
                            className="h-full w-full resize-none border border-dashed border-slate-300 bg-transparent p-1 text-[12px] text-slate-900 focus:border-slate-500 focus:outline-none"
                            style={{ lineHeight: cellLineHeight }}
                          />
                          {field.helpText ? (
                            <p className="text-[10px] text-slate-500">
                              {field.helpText}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {field.kind === "checkbox" ? (
                        <label className="flex h-full w-full items-center gap-2 text-[12px] text-slate-800">
                          <input
                            type="checkbox"
                            checked={values[field.id] === "true"}
                            onChange={(event) =>
                              updateValue(
                                field.id,
                                event.target.checked ? "true" : "false",
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          {field.label || "Checkbox"}
                        </label>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </SurfaceCard>
          ))
        : null}

      {signatureFields.length > 0 && showFormCanvas ? (
        <SurfaceCard className="space-y-4 border-slate-200/80 p-4">
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-900">
              Digital signature
            </p>
            <p className="text-xs text-slate-500">
              Complete the signature step below the form.
            </p>
          </div>

          <div className="space-y-4">
            {signatureFields.map((field) => (
              <FormSignatureField
                key={field.id}
                fieldId={field.id}
                label="Signature"
                required={field.required ?? true}
                value={values[field.id] ?? ""}
                onChange={(nextValue) => updateValue(field.id, nextValue)}
              />
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {shouldShowWorkflowTaskDetails ? (
        <SurfaceCard className="space-y-3 border-slate-200/80 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-slate-900">
              Upcoming tasks
            </p>
            <p className="text-xs text-slate-500">
              The workflow progresses in order and shows who will act on each
              step.
            </p>
          </div>

          <div className="space-y-2">
            {workflowRoadmap.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                  task.isCurrent
                    ? "border-cyan-200 bg-cyan-50/80"
                    : "border-slate-200 bg-white/80",
                )}
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {task.index + 1}. {task.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {task.type === "fillform"
                      ? "Form completion"
                      : "Digital signature"}
                  </p>
                </div>
                <div className="text-xs font-medium text-slate-600 sm:text-right">
                  {getTaskAssignmentSummary(task)}
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {shouldShowWorkflowTaskDetails ? (
        <SurfaceCard className="space-y-3">
          <p className="text-base font-semibold text-slate-900">
            Workflow status
          </p>
          {pendingForActor ? (
            <p className="text-sm text-slate-700">
              Pending task {Number(pendingForActor.currentTaskIndex ?? 0) + 1} -{" "}
              {pendingForActor.currentTaskTitle ?? "Untitled task"}
            </p>
          ) : null}
          {workflowItems.some((item) => item.status === "APPROVED") ? (
            <p className="text-sm font-semibold text-emerald-700">Approved</p>
          ) : null}
        </SurfaceCard>
      ) : null}

      {showCompleteTaskButton ? (
        <SurfaceCard className="space-y-3">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">
                Complete signature task
              </p>
              <p className="text-xs text-slate-500">
                Any one assigned user can complete this signature step.
              </p>
            </div>
            <Button
              onClick={handleCompleteSignatureTask}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Complete task"}
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      {showFormCanvas ? (
        <SurfaceCard className="space-y-3">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">
                {hasWorkflow && canActOnCurrentTask
                  ? "Finish current task"
                  : "Submit form"}
              </p>
              <p className="text-xs text-slate-500">
                {hasWorkflow && canActOnCurrentTask
                  ? "After completion, workflow moves to the next selected task."
                  : "Your input values will be saved in the database."}
              </p>
            </div>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? "Submitting..."
                : hasWorkflow && canActOnCurrentTask
                  ? "Finish task"
                  : "Submit"}
            </Button>
          </div>

          {submitMessage ? (
            <p
              className={cn(
                "text-sm font-semibold",
                submitTone === "success" ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {submitMessage}
            </p>
          ) : null}
        </SurfaceCard>
      ) : submitMessage ? (
        <SurfaceCard>
          <p
            className={cn(
              "text-sm font-semibold",
              submitTone === "success" ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {submitMessage}
          </p>
        </SurfaceCard>
      ) : null}
    </div>
  );
};
