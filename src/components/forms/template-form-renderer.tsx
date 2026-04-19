"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

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

export const TemplateFormRenderer = ({
  templateId,
  schema,
}: TemplateFormRendererProps) => {
  const pages = useMemo(() => schema.pages ?? [], [schema.pages]);
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
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitTone, setSubmitTone] = useState<"success" | "error" | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateValue = (fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    setSubmitMessage(null);
    setSubmitTone(null);

    const missing = pages
      .flatMap((page) => page.fields)
      .filter(
        (field) =>
          (field.kind === "input" || field.kind === "textarea") &&
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
      const response = await fetch("/api/forms/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          data: values,
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
    } catch (error) {
      setSubmitTone("error");
      setSubmitMessage(
        error instanceof Error ? error.message : "Unable to submit the form.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
      {pages.map((page, pageIndex) => (
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
                          field.inputType === "date" ? "DD/MM/YYYY" : undefined
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

                  {field.kind === "signature" ? (
                    <div
                      className="flex h-full w-full items-end justify-end gap-2 text-[11px] text-slate-900"
                      style={{ lineHeight: cellLineHeight }}
                    >
                      <span className="whitespace-nowrap">
                        (Signature with date)
                      </span>
                      <span className="min-w-0 flex-1 border-b border-dashed border-slate-400" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </SurfaceCard>
      ))}

      <SurfaceCard className="space-y-3">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-900">
              Submit form
            </p>
            <p className="text-xs text-slate-500">
              Your input values will be saved in the database.
            </p>
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
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
    </div>
  );
};
