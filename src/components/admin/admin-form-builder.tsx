"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SurfaceCard } from "@/components/ui/surface-card";
import { roleOptions, type RoleOptionKey } from "@/data/role-options";
import { cn } from "@/lib/utils";

type FieldKind =
  | "brand"
  | "text"
  | "input"
  | "textarea"
  | "checkbox"
  | "signature";

type InputFieldType = "text" | "email" | "tel" | "date" | "number";

type FieldWidth = "short" | "medium" | "long" | "full";

type FieldLayout = {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

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
  inputType: InputFieldType;
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
  helpText?: string;
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

type SaveMode = "draft" | "published";

type PersistedBuilderState = {
  formName: string;
  formDescription: string;
  pages: BuilderPage[];
  visibilityRoles: RoleOptionKey[];
  tasks: FormTask[];
};

type TaskType = "fillform" | "signature";

type AssignmentMode = "specific" | "role" | "department" | "all";

type TaskAssignment = {
  mode: AssignmentMode;
  values: string[]; // e.g. user ids, role keys, department ids or empty for all
};

type FormTask = {
  id: string;
  title: string;
  type: TaskType;
  formTemplateId?: string | null; // null means use current form
  assignment: TaskAssignment;
  status: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "DONE";
};

type WorkflowUserOption = {
  id: string;
  name: string;
  email: string;
  role?: { key: string; name: string } | null;
  department?: { id: string; name: string } | null;
};

type WorkflowDepartmentOption = {
  id: string;
  name: string;
};

type SelectableOption = {
  id: string;
  label: string;
  meta?: string;
};

type DragState =
  | {
      source: "palette";
      kind: FieldKind;
      preset?: { inputType?: InputFieldType };
    }
  | { source: "canvas"; fieldId: string; pageId: string };

type DropPreview = {
  pageId: string;
  layout: FieldLayout;
} | null;

type ResizeState = {
  pageId: string;
  fieldId: string;
  startX: number;
  startColSpan: number;
} | null;

type HeightResizeState = {
  pageId: string;
  fieldId: string;
  startY: number;
  startRowSpan: number;
} | null;

const GRID_UNIT_MM = 6;
const GRID_COLS = 30;
const GRID_ROWS = 45;
const MAX_TEXT_ROWS = 6;
const GRID_WIDTH_MM = GRID_COLS * GRID_UNIT_MM;
const GRID_HEIGHT_MM = GRID_ROWS * GRID_UNIT_MM;
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const PAGE_HORIZONTAL_MARGIN_MM = (PAGE_WIDTH_MM - GRID_WIDTH_MM) / 2;
const PAGE_VERTICAL_MARGIN_MM = (PAGE_HEIGHT_MM - GRID_HEIGHT_MM) / 2;

const widthBySize: Record<FieldWidth, number> = {
  short: 6,
  medium: 10,
  long: 16,
  full: GRID_COLS,
};

const paletteItems: Array<{
  id: string;
  kind: FieldKind;
  title: string;
  description: string;
  preset?: { inputType?: InputFieldType };
}> = [
  {
    id: "brand",
    kind: "brand",
    title: "College header",
    description: "Logo + institute title block for the page header.",
  },
  {
    id: "text",
    kind: "text",
    title: "Text block",
    description: "Headings, instructions, or notes.",
  },
  {
    id: "input-text",
    kind: "input",
    title: "Text input",
    description: "Single-line text.",
    preset: { inputType: "text" },
  },
  {
    id: "input-integer",
    kind: "input",
    title: "Integer input",
    description: "Whole numbers (uses number input).",
    preset: { inputType: "number" },
  },
  {
    id: "input-date",
    kind: "input",
    title: "Date",
    description: "Date picker field.",
    preset: { inputType: "date" },
  },
  {
    id: "input-email",
    kind: "input",
    title: "Email",
    description: "Email address field.",
    preset: { inputType: "email" },
  },
  {
    id: "input-phone",
    kind: "input",
    title: "Phone",
    description: "Phone number field.",
    preset: { inputType: "tel" },
  },
  {
    id: "checkbox",
    kind: "checkbox",
    title: "Checkbox",
    description: "Yes/No or acknowledgement field.",
  },
  {
    id: "signature",
    kind: "signature",
    title: "Signature",
    description: "Applicant signature line (use near the bottom).",
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `field-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

const normalizeLayout = (layout: FieldLayout) => {
  const maxCol = GRID_COLS - layout.colSpan + 1;
  const maxRow = GRID_ROWS - layout.rowSpan + 1;
  return {
    ...layout,
    col: clamp(layout.col, 1, Math.max(1, maxCol)),
    row: clamp(layout.row, 1, Math.max(1, maxRow)),
  };
};

const placeholderLabels = new Set([
  "field label",
  "text box label",
  "textbox label",
  "checkbox label",
  "add label",
]);

const sanitizeLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (placeholderLabels.has(trimmed.toLowerCase())) return "";
  return trimmed;
};

const isOverlapping = (a: FieldLayout, b: FieldLayout) => {
  const aColEnd = a.col + a.colSpan - 1;
  const aRowEnd = a.row + a.rowSpan - 1;
  const bColEnd = b.col + b.colSpan - 1;
  const bRowEnd = b.row + b.rowSpan - 1;
  if (aColEnd < b.col || bColEnd < a.col) return false;
  if (aRowEnd < b.row || bRowEnd < a.row) return false;
  return true;
};

const resolvePlacement = (
  fields: BuilderField[],
  layout: FieldLayout,
  preferredCol: number,
  preferredRow: number,
  ignoreId?: string,
) => {
  const maxCol = GRID_COLS - layout.colSpan + 1;
  const maxRow = GRID_ROWS - layout.rowSpan + 1;
  const startCol = clamp(preferredCol, 1, Math.max(1, maxCol));
  const startRow = clamp(preferredRow, 1, Math.max(1, maxRow));

  const isFree = (col: number, row: number) => {
    const candidate = { ...layout, col, row };
    return fields.every((field) => {
      if (field.id === ignoreId) return true;
      return !isOverlapping(candidate, field.layout);
    });
  };

  for (let row = startRow; row <= maxRow; row += 1) {
    for (let col = row === startRow ? startCol : 1; col <= maxCol; col += 1) {
      if (isFree(col, row)) return { col, row };
    }
  }

  for (let row = 1; row <= startRow; row += 1) {
    for (let col = 1; col <= maxCol; col += 1) {
      if (isFree(col, row)) return { col, row };
    }
  }

  return { col: startCol, row: startRow };
};

const createBrandField = (): BrandField => ({
  id: createId(),
  kind: "brand",
  collegeName: "INDIAN INSTITUTE OF TECHNOLOGY ROPAR",
  formHeading: "",
  showLogo: true,
  layout: {
    col: 1,
    row: 1,
    colSpan: GRID_COLS,
    rowSpan: 7,
  },
});

const createPage = (index: number, includeBrand = false): BuilderPage => ({
  id: createId(),
  title: `Page ${index + 1}`,
  fields: includeBrand ? [createBrandField()] : [],
});

const createField = (
  kind: FieldKind,
  preset?: { inputType?: InputFieldType },
): BuilderField => {
  if (kind === "brand") {
    return createBrandField();
  }

  if (kind === "text") {
    return {
      id: createId(),
      kind: "text",
      content: "",
      alignment: "left",
      rows: 2,
      width: "long",
      layout: {
        col: 1,
        row: 1,
        colSpan: widthBySize.long,
        rowSpan: 2,
      },
    };
  }

  if (kind === "signature") {
    return {
      id: createId(),
      kind: "signature",
      layout: {
        col: 1,
        row: GRID_ROWS,
        colSpan: 18,
        rowSpan: 1,
      },
    };
  }

  if (kind === "textarea") {
    return {
      id: createId(),
      kind: "textarea",
      label: "",
      value: "",
      required: false,
      minLength: null,
      maxLength: null,
      helpText: "",
      rows: 1,
      width: "short",
      layout: {
        col: 1,
        row: 1,
        colSpan: 2,
        rowSpan: 1,
      },
    };
  }

  if (kind === "checkbox") {
    return {
      id: createId(),
      kind: "checkbox",
      label: "",
      defaultChecked: false,
      width: "medium",
      layout: {
        col: 1,
        row: 1,
        colSpan: widthBySize.medium,
        rowSpan: 1,
      },
    };
  }

  return {
    id: createId(),
    kind: "input",
    label: "",
    inputType: preset?.inputType ?? "text",
    required: false,
    minLength: null,
    maxLength: null,
    helpText: "",
    width: "long",
    layout: {
      col: 1,
      row: 1,
      colSpan: widthBySize.long,
      rowSpan: 1,
    },
  };
};

export const AdminFormBuilder = () => {
  const searchParams = useSearchParams();
  const queryTemplateId = searchParams.get("templateId");
  const [formName, setFormName] = useState("New form");
  const [formDescription, setFormDescription] = useState("");
  const [pages, setPages] = useState<BuilderPage[]>([createPage(0, true)]);
  const [elementSearch, setElementSearch] = useState("");
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const [visibilityRoles, setVisibilityRoles] = useState<RoleOptionKey[]>(
    roleOptions.map((role) => role.key),
  );
  const [tasks, setTasks] = useState<FormTask[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskWizardStep, setTaskWizardStep] = useState(1);
  const [taskDraft, setTaskDraft] = useState<Partial<FormTask> | null>(null);
  const [workflowUsers, setWorkflowUsers] = useState<WorkflowUserOption[]>([]);
  const [workflowDepartments, setWorkflowDepartments] = useState<
    WorkflowDepartmentOption[]
  >([]);
  const [selectedItem, setSelectedItem] = useState<{
    pageId: string;
    fieldId: string;
  } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview>(null);
  const [settingsPageId, setSettingsPageId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<BuilderField | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [createdTemplateId, setCreatedTemplateId] = useState<string | null>(
    null,
  );
  const currentTemplateId = queryTemplateId ?? createdTemplateId;
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const gridRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const textAreaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const [editingTextAreaId, setEditingTextAreaId] = useState<string | null>(
    null,
  );
  const [resizeState, setResizeState] = useState<ResizeState>(null);
  const [heightResizeState, setHeightResizeState] =
    useState<HeightResizeState>(null);

  const setTextAreaRef =
    (fieldId: string) => (node: HTMLTextAreaElement | null) => {
      if (!node) {
        textAreaRefs.current.delete(fieldId);
        return;
      }
      textAreaRefs.current.set(fieldId, node);
    };

  const getCellSize = useCallback((pageId: string) => {
    const grid = gridRefs.current.get(pageId);
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    return {
      cellWidth: rect.width / GRID_COLS,
      cellHeight: rect.height / GRID_ROWS,
    };
  }, []);

  const cellLineHeight = `${GRID_UNIT_MM}mm`;

  const taskRoleOptions = useMemo<SelectableOption[]>(
    () => roleOptions.map((role) => ({ id: role.key, label: role.label })),
    [],
  );

  const taskDepartmentOptions = useMemo<SelectableOption[]>(
    () =>
      workflowDepartments.map((department) => ({
        id: department.id,
        label: department.name,
      })),
    [workflowDepartments],
  );

  const taskUserOptions = useMemo<SelectableOption[]>(
    () =>
      workflowUsers.map((user) => ({
        id: user.id,
        label: user.name,
        meta: user.email,
      })),
    [workflowUsers],
  );

  const toggleTaskAssignmentValue = useCallback((value: string) => {
    setTaskDraft((prev) => {
      if (!prev) return prev;
      if (!prev.assignment) return prev;
      const current = prev.assignment?.values ?? [];
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      return {
        ...prev,
        assignment: {
          mode: prev.assignment.mode,
          values: next,
        },
      };
    });
  }, []);

  const selectedTaskRoleLabels = (
    taskDraft?.assignment?.mode === "role" ? taskDraft.assignment.values : []
  )
    .map(
      (value) => taskRoleOptions.find((option) => option.id === value)?.label,
    )
    .filter((value): value is string => Boolean(value));

  const selectedTaskDepartmentLabels = (
    taskDraft?.assignment?.mode === "department"
      ? taskDraft.assignment.values
      : []
  )
    .map(
      (value) =>
        taskDepartmentOptions.find((option) => option.id === value)?.label,
    )
    .filter((value): value is string => Boolean(value));

  const selectedTaskUserOptions = (
    taskDraft?.assignment?.mode === "specific"
      ? taskDraft.assignment.values
      : []
  )
    .map((value) => taskUserOptions.find((option) => option.id === value))
    .filter((value): value is SelectableOption => Boolean(value));

  const selectedTaskAssignmentValues = taskDraft?.assignment?.values ?? [];

  const renderSelectedChips = (labels: string[]) =>
    labels.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-2">
        {labels.map((label) => (
          <span
            key={label}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
          >
            {label}
          </span>
        ))}
      </div>
    ) : (
      <p className="mt-3 text-xs text-slate-500">No selection yet.</p>
    );

  const renderSelectableGrid = (
    options: SelectableOption[],
    selectedIds: string[],
  ) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const selected = selectedIds.includes(option.id);

        return (
          <div
            key={option.id}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-4 py-3 transition",
              selected
                ? "border-cyan-200 bg-cyan-50/80 shadow-sm"
                : "border-slate-200 bg-white/90 hover:border-slate-300 hover:bg-white",
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {option.label}
              </p>
              {option.meta ? (
                <p className="truncate text-xs text-slate-500">{option.meta}</p>
              ) : null}
            </div>
            <div className="ml-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleTaskAssignmentValue(option.id)}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition",
                  selected
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                )}
                aria-label={
                  selected ? `Remove ${option.label}` : `Add ${option.label}`
                }
              >
                {selected ? "−" : "+"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const storageKey = useMemo(
    () => `admin-form-builder:draft:${currentTemplateId ?? "new"}`,
    [currentTemplateId],
  );

  useEffect(() => {
    let cancelled = false;

    const loadWorkflowOptions = async () => {
      try {
        const [usersRes, metaRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/statistics/meta"),
        ]);

        if (!usersRes.ok || !metaRes.ok) return;

        const usersPayload = (await usersRes.json()) as {
          ok?: boolean;
          data?: WorkflowUserOption[];
        };

        const metaPayload = (await metaRes.json()) as {
          ok?: boolean;
          data?: {
            departments?: WorkflowDepartmentOption[];
          };
        };

        if (cancelled) return;

        setWorkflowUsers(usersPayload.data ?? []);
        setWorkflowDepartments(metaPayload.data?.departments ?? []);
      } catch {
        // Keep editor usable even when dropdown data API is unavailable.
      }
    };

    void loadWorkflowOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyBuilderState = (state: PersistedBuilderState) => {
      setFormName(state.formName || "New form");
      setFormDescription(state.formDescription || "");
      setPages(state.pages.length > 0 ? state.pages : [createPage(0, true)]);
      setVisibilityRoles(
        state.visibilityRoles.length > 0
          ? state.visibilityRoles
          : roleOptions.map((role) => role.key),
      );
      setTasks(Array.isArray(state.tasks) ? state.tasks : []);
      setSelectedItem(null);
      setSettingsDraft(null);
      setSettingsPageId(null);
      setIsSettingsOpen(false);
      setStatusMessage(null);
      setStatusTone(null);
    };

    const parseLocalState = (
      raw: string | null,
    ): PersistedBuilderState | null => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Partial<PersistedBuilderState>;
        if (!parsed || typeof parsed !== "object") return null;
        if (!Array.isArray(parsed.pages) || parsed.pages.length === 0)
          return null;
        const nextVisibility = Array.isArray(parsed.visibilityRoles)
          ? parsed.visibilityRoles.filter((entry): entry is RoleOptionKey =>
              roleOptions.some((role) => role.key === entry),
            )
          : [];
        return {
          formName:
            typeof parsed.formName === "string" ? parsed.formName : "New form",
          formDescription:
            typeof parsed.formDescription === "string"
              ? parsed.formDescription
              : "",
          pages: parsed.pages,
          visibilityRoles: nextVisibility,
          tasks: Array.isArray(parsed.tasks)
            ? (parsed.tasks as FormTask[])
            : [],
        };
      } catch {
        return null;
      }
    };

    const bootstrap = async () => {
      const local =
        typeof window !== "undefined"
          ? parseLocalState(window.localStorage.getItem(storageKey))
          : null;

      if (local) {
        if (!cancelled) {
          applyBuilderState(local);
          setIsBootstrapped(true);
        }
        return;
      }

      if (!currentTemplateId) {
        if (!cancelled) {
          setIsBootstrapped(true);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/admin/form-templates?id=${encodeURIComponent(currentTemplateId)}`,
        );
        const data = (await response.json()) as {
          ok?: boolean;
          message?: string;
          data?: {
            id: string;
            name: string;
            description: string | null;
            schema: {
              visibilityRoles?: string[];
              pages?: BuilderPage[];
            };
          };
        };

        if (!response.ok || !data?.data) {
          if (!cancelled) {
            setStatusTone("error");
            setStatusMessage(
              data.message ?? "Unable to load form for editing.",
            );
          }
          return;
        }

        if (cancelled) return;

        applyBuilderState({
          formName: data.data.name,
          formDescription: data.data.description ?? "",
          pages: data.data.schema?.pages ?? [createPage(0, true)],
          visibilityRoles: (data.data.schema?.visibilityRoles ?? []).filter(
            (entry): entry is RoleOptionKey =>
              roleOptions.some((role) => role.key === entry),
          ),
          tasks: Array.isArray((data.data.schema as { tasks?: unknown }).tasks)
            ? ((data.data.schema as { tasks?: FormTask[] }).tasks ?? [])
            : [],
        });
      } catch (error) {
        console.error("Unable to bootstrap form builder", error);
        if (!cancelled) {
          setStatusTone("error");
          setStatusMessage("Unable to load form for editing.");
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapped(true);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [currentTemplateId, storageKey]);

  useEffect(() => {
    if (!isBootstrapped || typeof window === "undefined") return;
    const payload: PersistedBuilderState = {
      formName,
      formDescription,
      pages,
      visibilityRoles,
      tasks,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    formDescription,
    formName,
    isBootstrapped,
    pages,
    storageKey,
    tasks,
    visibilityRoles,
  ]);

  const filteredPaletteItems = useMemo(() => {
    const query = elementSearch.trim().toLowerCase();
    if (!query) return paletteItems;
    return paletteItems.filter((item) => {
      const haystack = `${item.title} ${item.description}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [elementSearch]);

  const resizeTextAreaToContent = useCallback(
    (pageId: string, fieldId: string, element: HTMLTextAreaElement) => {
      const cellSize = getCellSize(pageId);
      if (!cellSize) return;

      setPages((prev) =>
        prev.map((page) => {
          if (page.id !== pageId) return page;

          const target = page.fields.find(
            (field) => field.id === fieldId && field.kind === "textarea",
          );
          if (!target || target.kind !== "textarea") return page;

          const maxRowSpan = GRID_ROWS - target.layout.row + 1;
          const desiredRowSpan = clamp(
            Math.ceil(element.scrollHeight / Math.max(1, cellSize.cellHeight)),
            1,
            Math.max(1, maxRowSpan),
          );

          if (desiredRowSpan === target.layout.rowSpan) return page;

          const others = page.fields.filter((field) => field.id !== fieldId);
          const candidate = normalizeLayout({
            ...target.layout,
            rowSpan: desiredRowSpan,
          });
          const overlaps = others.some((field) =>
            isOverlapping(candidate, field.layout),
          );

          if (overlaps && desiredRowSpan > target.layout.rowSpan) {
            for (
              let span = desiredRowSpan - 1;
              span >= target.layout.rowSpan;
              span -= 1
            ) {
              const attempt = normalizeLayout({
                ...target.layout,
                rowSpan: span,
              });
              const ok = others.every(
                (field) => !isOverlapping(attempt, field.layout),
              );
              if (ok) {
                return {
                  ...page,
                  fields: page.fields.map((field) =>
                    field.id === fieldId && field.kind === "textarea"
                      ? {
                          ...field,
                          rows: span,
                          layout: { ...field.layout, rowSpan: span },
                        }
                      : field,
                  ),
                };
              }
            }

            return page;
          }

          if (overlaps) return page;

          return {
            ...page,
            fields: page.fields.map((field) =>
              field.id === fieldId && field.kind === "textarea"
                ? {
                    ...field,
                    rows: desiredRowSpan,
                    layout: { ...field.layout, rowSpan: desiredRowSpan },
                  }
                : field,
            ),
          };
        }),
      );
    },
    [getCellSize],
  );

  const minColSpanByField = (field: BuilderField) => {
    if (field.kind === "textarea") return 2;
    return 1;
  };

  useEffect(() => {
    if (!resizeState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const cellSize = getCellSize(resizeState.pageId);
      if (!cellSize) return;

      setPages((prev) =>
        prev.map((page) => {
          if (page.id !== resizeState.pageId) return page;
          const target = page.fields.find(
            (field) => field.id === resizeState.fieldId,
          );
          if (!target) return page;

          const deltaCells = Math.round(
            (event.clientX - resizeState.startX) /
              Math.max(1, cellSize.cellWidth),
          );

          const maxColSpan = GRID_COLS - target.layout.col + 1;
          const nextColSpan = clamp(
            resizeState.startColSpan + deltaCells,
            minColSpanByField(target),
            Math.max(1, maxColSpan),
          );

          if (nextColSpan === target.layout.colSpan) return page;

          const candidateLayout = normalizeLayout({
            ...target.layout,
            colSpan: nextColSpan,
            rowSpan:
              target.kind === "textarea" || target.kind === "text"
                ? target.layout.rowSpan
                : 1,
          });

          const others = page.fields.filter((field) => field.id !== target.id);
          const overlaps = others.some((field) =>
            isOverlapping(candidateLayout, field.layout),
          );
          if (overlaps) return page;

          return {
            ...page,
            fields: page.fields.map((field) =>
              field.id === target.id
                ? {
                    ...field,
                    layout: {
                      ...field.layout,
                      colSpan: candidateLayout.colSpan,
                    },
                  }
                : field,
            ),
          };
        }),
      );
    };

    const handlePointerUp = () => {
      const { pageId, fieldId } = resizeState;
      setResizeState(null);

      const element = textAreaRefs.current.get(fieldId);
      if (element) {
        resizeTextAreaToContent(pageId, fieldId, element);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [getCellSize, resizeState, resizeTextAreaToContent]);

  useEffect(() => {
    if (!heightResizeState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const cellSize = getCellSize(heightResizeState.pageId);
      if (!cellSize) return;

      setPages((prev) =>
        prev.map((page) => {
          if (page.id !== heightResizeState.pageId) return page;
          const target = page.fields.find(
            (field) => field.id === heightResizeState.fieldId,
          );
          if (!target || target.kind !== "text") return page;

          const deltaCells = Math.round(
            (event.clientY - heightResizeState.startY) /
              Math.max(1, cellSize.cellHeight),
          );

          const maxRowSpan = GRID_ROWS - target.layout.row + 1;
          const maxAllowed = Math.min(MAX_TEXT_ROWS, Math.max(1, maxRowSpan));
          const nextRowSpan = clamp(
            heightResizeState.startRowSpan + deltaCells,
            1,
            maxAllowed,
          );

          if (nextRowSpan === target.layout.rowSpan) return page;

          const candidateLayout = normalizeLayout({
            ...target.layout,
            rowSpan: nextRowSpan,
          });

          const others = page.fields.filter((field) => field.id !== target.id);
          const overlaps = others.some((field) =>
            isOverlapping(candidateLayout, field.layout),
          );
          if (overlaps) return page;

          return {
            ...page,
            fields: page.fields.map((field) =>
              field.id === target.id && field.kind === "text"
                ? {
                    ...field,
                    rows: candidateLayout.rowSpan,
                    layout: {
                      ...field.layout,
                      rowSpan: candidateLayout.rowSpan,
                    },
                  }
                : field,
            ),
          };
        }),
      );
    };

    const handlePointerUp = () => {
      setHeightResizeState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [getCellSize, heightResizeState]);

  const selectedPage = useMemo(() => {
    if (!selectedItem) return null;
    return pages.find((page) => page.id === selectedItem.pageId) ?? null;
  }, [pages, selectedItem]);

  const selectedField = useMemo(() => {
    if (!selectedItem || !selectedPage) return null;
    return (
      selectedPage.fields.find((field) => field.id === selectedItem.fieldId) ??
      null
    );
  }, [selectedItem, selectedPage]);

  const activePageId =
    selectedItem?.pageId ?? pages[pages.length - 1]?.id ?? pages[0].id;

  const setGridRef = (pageId: string) => (node: HTMLDivElement | null) => {
    if (!node) {
      gridRefs.current.delete(pageId);
      return;
    }
    gridRefs.current.set(pageId, node);
  };

  const clearSelection = () => {
    setEditingTextAreaId(null);
    if (!selectedItem || !selectedPage || !selectedField) {
      setSelectedItem(null);
      return;
    }

    if (
      selectedField.kind === "input" ||
      selectedField.kind === "textarea" ||
      selectedField.kind === "checkbox"
    ) {
      const cleaned = sanitizeLabel(selectedField.label);
      if (cleaned !== selectedField.label) {
        setPages((prev) =>
          prev.map((page) => {
            if (page.id !== selectedPage.id) return page;
            return {
              ...page,
              fields: page.fields.map((field) =>
                field.id === selectedField.id
                  ? { ...field, label: cleaned }
                  : field,
              ),
            };
          }),
        );
      }
    }

    setSelectedItem(null);
  };

  const openSettings = (pageId: string, field: BuilderField) => {
    if (field.kind === "brand") {
      return;
    }
    const draft = JSON.parse(JSON.stringify(field)) as BuilderField;
    setSettingsPageId(pageId);
    setSettingsDraft(draft);
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
    setSettingsPageId(null);
    setSettingsDraft(null);
  };

  const handleAddPage = () => {
    setPages((prev) => [...prev, createPage(prev.length, false)]);
  };

  const handleClearForm = () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Clear the current form layout? Unsaved edits will be lost.",
      );
      if (!confirmed) return;
    }

    const defaultVisibility = roleOptions.map((role) => role.key);
    setFormName("New form");
    setFormDescription("");
    setPages([createPage(0, true)]);
    setVisibilityRoles(defaultVisibility);
    setTasks([]);
    setSelectedItem(null);
    setDragState(null);
    setDropPreview(null);
    setSettingsPageId(null);
    setSettingsDraft(null);
    setIsSettingsOpen(false);
    setIsVisibilityOpen(false);
    setEditingTextAreaId(null);
    setResizeState(null);
    setHeightResizeState(null);
    setStatusTone("success");
    setStatusMessage("Form cleared. Start building again.");
  };

  const handleRemovePage = (pageId: string) => {
    const firstPageId = pages[0]?.id;
    if (firstPageId && pageId === firstPageId) {
      setStatusTone("error");
      setStatusMessage("The first page cannot be removed.");
      return;
    }

    setStatusMessage(null);
    setStatusTone(null);
    setPages((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((page) => page.id !== pageId);
      return next.length ? next : prev;
    });
    if (selectedItem?.pageId === pageId) {
      setSelectedItem(null);
    }
  };

  const placeField = (
    pageId: string,
    field: BuilderField,
    preferredCol: number,
    preferredRow: number,
  ) => {
    setStatusMessage(null);
    setStatusTone(null);
    setPages((prev) =>
      prev.map((page) => {
        if (page.id !== pageId) return page;
        const layout = normalizeLayout(field.layout);
        const resolved = resolvePlacement(
          page.fields,
          layout,
          preferredCol,
          preferredRow,
        );
        const nextField = {
          ...field,
          layout: { ...layout, ...resolved },
        };
        return { ...page, fields: [...page.fields, nextField] };
      }),
    );
    setSelectedItem({ pageId, fieldId: field.id });
  };

  const handleAddPaletteItem = (
    item: (typeof paletteItems)[number],
    pageId: string,
  ) => {
    const targetPage = pages.find((page) => page.id === pageId);
    if (!targetPage) return;

    if (item.kind === "brand") {
      const hasBrand = targetPage.fields.some(
        (field) => field.kind === "brand",
      );
      if (hasBrand) {
        setStatusTone("error");
        setStatusMessage("This page already has a college header block.");
        return;
      }
    }

    const newField = createField(item.kind, item.preset);
    const startRow =
      item.kind === "signature"
        ? GRID_ROWS
        : targetPage.fields.find((field) => field.kind === "brand")
          ? 8
          : 1;
    placeField(pageId, newField, 1, startRow);
  };

  const handleDragStartPalette = (
    event: DragEvent,
    item: (typeof paletteItems)[number],
  ) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", item.id);
    setDragState({ source: "palette", kind: item.kind, preset: item.preset });
  };

  const handleDragStartField = (
    event: DragEvent,
    pageId: string,
    fieldId: string,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", fieldId);
    setDragState({ source: "canvas", pageId, fieldId });
  };

  const getCellFromEvent = (event: DragEvent, pageId: string) => {
    const grid = gridRefs.current.get(pageId);
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const cellWidth = rect.width / GRID_COLS;
    const cellHeight = rect.height / GRID_ROWS;
    const col = clamp(
      Math.floor((event.clientX - rect.left) / cellWidth) + 1,
      1,
      GRID_COLS,
    );
    const row = clamp(
      Math.floor((event.clientY - rect.top) / cellHeight) + 1,
      1,
      GRID_ROWS,
    );
    return { col, row };
  };

  const handleDragOverGrid = (event: DragEvent, pageId: string) => {
    if (!dragState) return;
    event.preventDefault();
    event.dataTransfer.dropEffect =
      dragState.source === "palette" ? "copy" : "move";

    const cell = getCellFromEvent(event, pageId);
    if (!cell) return;

    const page = pages.find((entry) => entry.id === pageId);
    if (!page) return;

    let layout: FieldLayout | null = null;
    let ignoreId: string | undefined;

    if (dragState.source === "palette") {
      const draftField = createField(dragState.kind, dragState.preset);
      layout = draftField.layout;
    } else {
      const sourcePage = pages.find((entry) => entry.id === dragState.pageId);
      const sourceField = sourcePage?.fields.find(
        (field) => field.id === dragState.fieldId,
      );
      if (sourceField) {
        layout = sourceField.layout;
        ignoreId = sourceField.id;
      }
    }

    if (!layout) return;
    const normalized = normalizeLayout(layout);
    const resolved = resolvePlacement(
      page.fields,
      normalized,
      cell.col,
      cell.row,
      ignoreId,
    );

    setDropPreview({
      pageId,
      layout: { ...normalized, ...resolved },
    });
  };

  const handleDropGrid = (event: DragEvent, pageId: string) => {
    if (!dragState) return;
    event.preventDefault();

    const preview = dropPreview?.pageId === pageId ? dropPreview.layout : null;
    const cell = preview
      ? { col: preview.col, row: preview.row }
      : getCellFromEvent(event, pageId);

    if (!cell) return;

    if (dragState.source === "palette") {
      const targetPage = pages.find((entry) => entry.id === pageId);
      if (!targetPage) return;
      if (
        dragState.kind === "brand" &&
        targetPage.fields.some((field) => field.kind === "brand")
      ) {
        setStatusTone("error");
        setStatusMessage("This page already has a college header block.");
        setDragState(null);
        setDropPreview(null);
        return;
      }

      const newField = createField(dragState.kind, dragState.preset);
      const resolvedLayout = preview
        ? preview
        : normalizeLayout(newField.layout);
      const preferred = preview ? { col: preview.col, row: preview.row } : cell;
      placeField(
        pageId,
        { ...newField, layout: resolvedLayout },
        preferred.col,
        preferred.row,
      );
    }

    if (dragState.source === "canvas") {
      setPages((prev) => {
        const next = prev.map((page) => ({
          ...page,
          fields: [...page.fields],
        }));
        const sourcePage = next.find((entry) => entry.id === dragState.pageId);
        const targetPage = next.find((entry) => entry.id === pageId);
        if (!sourcePage || !targetPage) return prev;

        const fieldIndex = sourcePage.fields.findIndex(
          (field) => field.id === dragState.fieldId,
        );
        if (fieldIndex === -1) return prev;

        const [moved] = sourcePage.fields.splice(fieldIndex, 1);
        const normalized = normalizeLayout(moved.layout);
        const resolved = resolvePlacement(
          targetPage.fields,
          normalized,
          cell.col,
          cell.row,
          moved.id,
        );
        const updated = {
          ...moved,
          layout: { ...normalized, ...resolved },
        };
        targetPage.fields.push(updated);
        setSelectedItem({ pageId, fieldId: updated.id });
        return next;
      });
    }

    setDragState(null);
    setDropPreview(null);
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDropPreview(null);
  };

  const handleRemoveField = (pageId: string, fieldId: string) => {
    setStatusMessage(null);
    setStatusTone(null);
    setPages((prev) =>
      prev.map((page) =>
        page.id === pageId
          ? {
              ...page,
              fields: page.fields.filter((field) => field.id !== fieldId),
            }
          : page,
      ),
    );
    if (selectedItem?.fieldId === fieldId) {
      setSelectedItem(null);
    }
  };

  const handleSettingsSave = () => {
    if (!settingsDraft || !settingsPageId) return;

    const normalizedDraft = (() => {
      if (
        settingsDraft.kind === "input" ||
        settingsDraft.kind === "textarea" ||
        settingsDraft.kind === "checkbox"
      ) {
        return {
          ...settingsDraft,
          label: sanitizeLabel(settingsDraft.label),
          layout: normalizeLayout(settingsDraft.layout),
        };
      }

      return {
        ...settingsDraft,
        layout: normalizeLayout(settingsDraft.layout),
      };
    })();

    setPages((prev) =>
      prev.map((page) => {
        if (page.id !== settingsPageId) return page;
        const otherFields = page.fields.filter(
          (field) => field.id !== normalizedDraft.id,
        );
        const resolved = resolvePlacement(
          otherFields,
          normalizedDraft.layout,
          normalizedDraft.layout.col,
          normalizedDraft.layout.row,
        );
        const updatedField = {
          ...normalizedDraft,
          layout: { ...normalizedDraft.layout, ...resolved },
        };
        return {
          ...page,
          fields: page.fields.map((field) =>
            field.id === updatedField.id ? updatedField : field,
          ),
        };
      }),
    );

    setSelectedItem({ pageId: settingsPageId, fieldId: normalizedDraft.id });
    closeSettings();
  };

  const handleSave = async (roles: RoleOptionKey[], mode: SaveMode) => {
    setStatusMessage(null);
    setStatusTone(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setStatusTone("error");
      setStatusMessage("Form name is required.");
      return;
    }

    const totalFields = pages.reduce(
      (sum, page) => sum + page.fields.length,
      0,
    );
    const totalNonBrand = pages.reduce(
      (sum, page) =>
        sum + page.fields.filter((field) => field.kind !== "brand").length,
      0,
    );
    if (mode === "published" && (totalFields === 0 || totalNonBrand === 0)) {
      setStatusTone("error");
      setStatusMessage("Add at least one field before saving.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        ...(currentTemplateId ? { id: currentTemplateId } : {}),
        name: trimmedName,
        description: formDescription.trim() || null,
        schema: {
          version: 3,
          title: trimmedName,
          description: formDescription.trim() || null,
          visibilityRoles: roles,
          lifecycle: {
            status: mode,
          },
          grid: {
            unit: GRID_UNIT_MM,
            unitLabel: "mm",
            columns: GRID_COLS,
            rows: GRID_ROWS,
          },
          pages,
          tasks,
        },
      };

      const response = await fetch("/api/admin/form-templates", {
        method: currentTemplateId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          id?: string;
        };
      };

      if (!response.ok) {
        setStatusTone("error");
        setStatusMessage(data.message ?? "Unable to save the form.");
        return;
      }

      const savedId = data.data?.id;
      if (savedId) {
        setCreatedTemplateId(savedId);
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("admin-form-builder:draft:new");
        if (currentTemplateId) {
          window.localStorage.removeItem(
            `admin-form-builder:draft:${currentTemplateId}`,
          );
        }
        if (savedId) {
          window.localStorage.removeItem(`admin-form-builder:draft:${savedId}`);
        }
      }

      setStatusTone("success");
      setStatusMessage(
        data.message ??
          (mode === "draft"
            ? "Draft saved successfully."
            : "Form published successfully."),
      );
    } catch (error) {
      console.error("Form save failed", error);
      setStatusTone("error");
      setStatusMessage("Something went wrong while saving the form.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDispatchTask = async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "ASSIGNED" } : t)),
    );
    setStatusTone("success");
    setStatusMessage("Task dispatched.");
    // TODO: integrate with backend to actually assign to users based on filters
  };

  const handleDispatchAll = async () => {
    setTasks((prev) => prev.map((t) => ({ ...t, status: "ASSIGNED" })));
    setStatusTone("success");
    setStatusMessage("All tasks dispatched.");
    // TODO: call backend API to create task instances for each assigned user
  };

  return (
    <div className="space-y-6">
      <SurfaceCard className="space-y-5" spotlight>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="form-title">Form title</Label>
              <Input
                id="form-title"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="Form name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-description">Short description</Label>
              <Input
                id="form-description"
                value={formDescription}
                onChange={(event) => setFormDescription(event.target.value)}
                placeholder="Purpose or instructions"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="secondary" onClick={handleAddPage}>
              Add page
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsTaskModalOpen(true);
                setTaskWizardStep(1);
                setTaskDraft({
                  id: createId(),
                  title: "New task",
                  type: "fillform",
                  formTemplateId: currentTemplateId,
                  assignment: { mode: "all", values: [] },
                  status: "PENDING",
                });
              }}
            >
              Add task
            </Button>
            <Button
              variant="secondary"
              onClick={handleClearForm}
              disabled={isSaving || !isBootstrapped}
            >
              Clear form
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await handleSave(visibilityRoles, "draft");
              }}
              disabled={isSaving || !isBootstrapped}
            >
              {isSaving ? "Saving..." : "Save draft"}
            </Button>
            <Button
              onClick={() => setIsVisibilityOpen(true)}
              disabled={isSaving || !isBootstrapped}
            >
              {isSaving ? "Saving..." : "Save form"}
            </Button>
            {statusMessage ? (
              <p
                className={cn(
                  "text-sm font-semibold",
                  statusTone === "success"
                    ? "text-emerald-600"
                    : "text-rose-600",
                )}
              >
                {statusMessage}
              </p>
            ) : null}
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr_240px]">
        <SurfaceCard className="space-y-4">
          <div>
            <p className="text-base font-semibold text-slate-900">
              Form elements
            </p>
            <p className="text-xs text-slate-500">
              Drag into the sheet or click to add.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="element-search">Search elements</Label>
            <Input
              id="element-search"
              value={elementSearch}
              onChange={(event) => setElementSearch(event.target.value)}
              placeholder="Search"
            />
          </div>
          <div className="space-y-3">
            {filteredPaletteItems.map((item) => (
              <button
                key={item.id}
                type="button"
                draggable
                onClick={() => handleAddPaletteItem(item, activePageId)}
                onDragStart={(event) => handleDragStartPalette(event, item)}
                onDragEnd={handleDragEnd}
                className="w-full cursor-grab rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-300 hover:bg-white active:cursor-grabbing"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </button>
            ))}
            {filteredPaletteItems.length === 0 ? (
              <p className="text-xs text-slate-500">No matching elements.</p>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div className="space-y-6 overflow-x-auto">
            {pages.map((page, pageIndex) => (
              <div key={page.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <span>{page.title ?? `Page ${pageIndex + 1}`}</span>
                  {pages.length > 1 && pageIndex > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleRemovePage(page.id)}
                      className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Remove page
                    </button>
                  ) : null}
                </div>

                <div
                  className="mx-auto w-[210mm] min-h-[297mm] rounded-lg border border-slate-300 bg-white shadow-sm"
                  style={{
                    padding: `${PAGE_VERTICAL_MARGIN_MM}mm ${PAGE_HORIZONTAL_MARGIN_MM}mm`,
                    width: `${PAGE_WIDTH_MM}mm`,
                    minHeight: `${PAGE_HEIGHT_MM}mm`,
                  }}
                >
                  <div
                    ref={setGridRef(page.id)}
                    className="relative grid"
                    onDragOver={(event) => handleDragOverGrid(event, page.id)}
                    onDrop={(event) => handleDropGrid(event, page.id)}
                    onDragLeave={() => setDropPreview(null)}
                    onClick={(event) => {
                      if (event.target === event.currentTarget) {
                        clearSelection();
                      }
                    }}
                    style={{
                      gridTemplateColumns: `repeat(${GRID_COLS}, ${GRID_UNIT_MM}mm)`,
                      gridAutoRows: `${GRID_UNIT_MM}mm`,
                      width: `${GRID_WIDTH_MM}mm`,
                      height: `${GRID_HEIGHT_MM}mm`,
                      backgroundImage:
                        "linear-gradient(rgba(15, 23, 42, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.05) 1px, transparent 1px)",
                      backgroundSize: `${GRID_UNIT_MM}mm ${GRID_UNIT_MM}mm`,
                      backgroundPosition: `${GRID_UNIT_MM / -2}mm ${GRID_UNIT_MM / -2}mm`,
                    }}
                  >
                    {page.fields.map((field) => (
                      <div
                        key={field.id}
                        draggable={
                          field.kind !== "brand" &&
                          !(
                            field.kind === "textarea" &&
                            editingTextAreaId === field.id
                          )
                        }
                        onDragStart={(event) =>
                          handleDragStartField(event, page.id, field.id)
                        }
                        onDragEnd={handleDragEnd}
                        onClick={() =>
                          setSelectedItem({
                            pageId: page.id,
                            fieldId: field.id,
                          })
                        }
                        className={cn(
                          "group relative transition",
                          (field.kind === "text" ||
                            field.kind === "input" ||
                            field.kind === "textarea" ||
                            field.kind === "checkbox") &&
                            "rounded-sm border border-slate-200 bg-white/60",
                          field.kind === "textarea"
                            ? editingTextAreaId === field.id
                              ? "cursor-text"
                              : "cursor-pointer"
                            : field.kind === "brand"
                              ? "cursor-default"
                              : "cursor-grab rounded-md active:cursor-grabbing",
                          selectedItem?.fieldId === field.id
                            ? "border-slate-300 bg-white/95 ring-2 ring-slate-300"
                            : "hover:bg-white/70",
                        )}
                        style={{
                          gridColumn: `${field.layout.col} / span ${field.layout.colSpan}`,
                          gridRow: `${field.layout.row} / span ${field.layout.rowSpan}`,
                        }}
                      >
                        {selectedItem?.fieldId === field.id &&
                        field.kind !== "brand" ? (
                          <button
                            type="button"
                            aria-label="Resize field"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                              setResizeState({
                                pageId: page.id,
                                fieldId: field.id,
                                startX: event.clientX,
                                startColSpan: field.layout.colSpan,
                              });
                            }}
                            className="absolute -right-1 top-1/2 z-10 h-6 w-3 -translate-y-1/2 cursor-col-resize rounded border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 shadow-sm"
                          >
                            ↔
                          </button>
                        ) : null}
                        {selectedItem?.fieldId === field.id &&
                        field.kind === "text" ? (
                          <button
                            type="button"
                            aria-label="Resize text height"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                              setHeightResizeState({
                                pageId: page.id,
                                fieldId: field.id,
                                startY: event.clientY,
                                startRowSpan: field.layout.rowSpan,
                              });
                            }}
                            className="absolute bottom-0 left-1/2 z-10 h-3 w-6 -translate-x-1/2 cursor-row-resize rounded border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 shadow-sm"
                          >
                            ↕
                          </button>
                        ) : null}
                        {field.kind !== "textarea" ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveField(page.id, field.id);
                            }}
                            className="absolute right-2 top-2 text-[10px] font-semibold text-rose-500 opacity-0 transition group-hover:opacity-100"
                          >
                            Remove
                          </button>
                        ) : null}

                        {field.kind !== "textarea" &&
                        field.kind !== "signature" ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openSettings(page.id, field);
                            }}
                            className="absolute right-2 bottom-2 text-[10px] font-semibold text-slate-600 opacity-0 transition group-hover:opacity-100"
                          >
                            Edit
                          </button>
                        ) : null}

                        {field.kind === "brand" ? (
                          <div className="flex h-full w-full flex-col items-center justify-center px-2">
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
                            <div
                              className="mt-1 flex w-full flex-col items-center"
                              style={{ lineHeight: cellLineHeight }}
                            >
                              <p className="text-[12px] font-semibold text-slate-900">
                                भारतीय प्रौद्योगिकी संस्थान रोपड़
                              </p>
                              <p className="text-[12px] font-bold tracking-wide text-slate-900">
                                INDIAN INSTITUTE OF TECHNOLOGY ROPAR
                              </p>
                              <p className="text-[11px] font-medium text-slate-700">
                                नंगल रोड, रूपनगर, पंजाब-140001 / Nangal Road,
                                Rupnagar, Punjab-140001
                              </p>
                            </div>
                            <input
                              value={field.formHeading}
                              placeholder="Heading of the form"
                              onChange={(event) => {
                                const nextHeading = event.target.value;
                                setPages((prev) =>
                                  prev.map((pageEntry) => {
                                    if (pageEntry.id !== page.id)
                                      return pageEntry;
                                    return {
                                      ...pageEntry,
                                      fields: pageEntry.fields.map((item) =>
                                        item.id === field.id &&
                                        item.kind === "brand"
                                          ? {
                                              ...item,
                                              formHeading: nextHeading,
                                            }
                                          : item,
                                      ),
                                    };
                                  }),
                                );
                              }}
                              className="mt-1 w-full border-0 bg-transparent px-1 text-center text-[12px] font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                              style={{ lineHeight: cellLineHeight }}
                            />
                          </div>
                        ) : null}

                        {field.kind === "text" ? (
                          <textarea
                            value={field.content}
                            onChange={(event) =>
                              setPages((prev) =>
                                prev.map((pageEntry) => {
                                  if (pageEntry.id !== page.id)
                                    return pageEntry;
                                  return {
                                    ...pageEntry,
                                    fields: pageEntry.fields.map((item) =>
                                      item.id === field.id &&
                                      item.kind === "text"
                                        ? {
                                            ...item,
                                            content: event.target.value,
                                          }
                                        : item,
                                    ),
                                  };
                                }),
                              )
                            }
                            onClick={() =>
                              setSelectedItem({
                                pageId: page.id,
                                fieldId: field.id,
                              })
                            }
                            className={cn(
                              "h-full w-full resize-none bg-transparent p-0 text-[12px] text-slate-900 focus:outline-none",
                              field.alignment === "center" && "text-center",
                              field.alignment === "right" && "text-right",
                            )}
                            style={{ lineHeight: cellLineHeight }}
                            rows={Math.max(1, field.layout.rowSpan)}
                          />
                        ) : null}

                        {field.kind === "input" ? (
                          <div
                            className="flex h-full w-full items-end gap-2 overflow-hidden px-1"
                            style={{ lineHeight: cellLineHeight }}
                          >
                            <span
                              className={cn(
                                "text-[12px] font-semibold",
                                field.label.trim().length > 0
                                  ? "text-slate-900"
                                  : "text-slate-400 italic",
                              )}
                            >
                              {field.label.trim().length > 0
                                ? field.label
                                : selectedItem?.fieldId === field.id
                                  ? "Add label"
                                  : ""}
                            </span>
                            <div className="min-w-0 flex-1">
                              {field.inputType === "date" ? (
                                <input
                                  type="date"
                                  placeholder="DD/MM/YYYY"
                                  onPointerDown={(event) =>
                                    event.stopPropagation()
                                  }
                                  className={cn(
                                    "h-[6mm] w-full border-0 border-b border-dashed border-slate-400 bg-transparent px-0 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none",
                                    selectedItem?.fieldId === field.id
                                      ? "pointer-events-auto"
                                      : "pointer-events-none",
                                  )}
                                  style={{ lineHeight: cellLineHeight }}
                                />
                              ) : (
                                <div className="border-b border-dashed border-slate-400" />
                              )}
                            </div>
                          </div>
                        ) : null}

                        {field.kind === "signature" ? (
                          <div
                            className="flex h-full w-full items-end justify-end gap-2 overflow-hidden px-1 text-[11px] text-slate-900"
                            style={{ lineHeight: cellLineHeight }}
                          >
                            <span className="whitespace-nowrap">
                              (Signature of Applicant&apos;s with date) / आवेदक
                              के हस्ताक्षर दिनांक सहित
                            </span>
                            <span className="min-w-0 flex-1 border-b border-dashed border-slate-400" />
                          </div>
                        ) : null}

                        {field.kind === "textarea" ? (
                          <div className="relative h-full w-full">
                            {selectedItem?.fieldId === field.id ? (
                              <div className="absolute right-1 top-1 z-10 flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Remove text box"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setEditingTextAreaId(null);
                                    handleRemoveField(page.id, field.id);
                                  }}
                                  className="h-6 w-6 rounded border border-slate-200 bg-white text-[12px] font-semibold text-rose-600 shadow-sm"
                                >
                                  ×
                                </button>
                                <button
                                  type="button"
                                  aria-label="Edit text box"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedItem({
                                      pageId: page.id,
                                      fieldId: field.id,
                                    });
                                    setEditingTextAreaId(field.id);
                                    window.requestAnimationFrame(() => {
                                      textAreaRefs.current
                                        .get(field.id)
                                        ?.focus();
                                    });
                                  }}
                                  className="h-6 w-6 rounded border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 shadow-sm"
                                >
                                  ✎
                                </button>
                              </div>
                            ) : null}

                            <div className="h-full w-full border border-transparent">
                              <textarea
                                ref={setTextAreaRef(field.id)}
                                value={field.value}
                                readOnly={editingTextAreaId !== field.id}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setPages((prev) =>
                                    prev.map((pageEntry) => {
                                      if (pageEntry.id !== page.id)
                                        return pageEntry;
                                      return {
                                        ...pageEntry,
                                        fields: pageEntry.fields.map((item) =>
                                          item.id === field.id &&
                                          item.kind === "textarea"
                                            ? { ...item, value: nextValue }
                                            : item,
                                        ),
                                      };
                                    }),
                                  );
                                  resizeTextAreaToContent(
                                    page.id,
                                    field.id,
                                    event.target,
                                  );
                                }}
                                onBlur={() => {
                                  setEditingTextAreaId((prev) =>
                                    prev === field.id ? null : prev,
                                  );
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedItem({
                                    pageId: page.id,
                                    fieldId: field.id,
                                  });
                                }}
                                className={cn(
                                  "h-full w-full resize-none overflow-hidden bg-transparent p-1 text-[12px] text-slate-900 focus:outline-none",
                                  editingTextAreaId === field.id
                                    ? "cursor-text"
                                    : "pointer-events-none cursor-pointer",
                                )}
                                style={{ lineHeight: cellLineHeight }}
                                rows={Math.max(1, field.layout.rowSpan)}
                              />
                            </div>
                          </div>
                        ) : null}

                        {field.kind === "checkbox" ? (
                          <div
                            className="flex h-full w-full items-end gap-2 overflow-hidden px-1 text-[12px] font-semibold"
                            style={{ lineHeight: cellLineHeight }}
                          >
                            <input
                              type="checkbox"
                              checked={field.defaultChecked}
                              readOnly
                              className="h-3.5 w-3.5 -translate-y-px rounded border-slate-400 text-slate-900"
                            />
                            <span
                              className={cn(
                                field.label.trim().length > 0
                                  ? "text-slate-900"
                                  : "text-slate-400 italic",
                              )}
                            >
                              {field.label.trim().length > 0
                                ? field.label
                                : selectedItem?.fieldId === field.id
                                  ? "Add label"
                                  : ""}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ))}

                    {dropPreview && dropPreview.pageId === page.id ? (
                      <div
                        className="pointer-events-none rounded-md border border-slate-900/40 bg-slate-900/5"
                        style={{
                          gridColumn: `${dropPreview.layout.col} / span ${dropPreview.layout.colSpan}`,
                          gridRow: `${dropPreview.layout.row} / span ${dropPreview.layout.rowSpan}`,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div>
            <p className="text-base font-semibold text-slate-900">Inspector</p>
            <p className="text-xs text-slate-500">
              Select a field to edit its settings.
            </p>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-900">Tasks</p>
            <p className="text-xs text-slate-500">
              Create and assign tasks for this form.
            </p>
            <div className="mt-3 space-y-2">
              {tasks.length === 0 ? (
                <p className="text-xs text-slate-500">No tasks created yet.</p>
              ) : (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {t.title}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t.type === "fillform"
                            ? "Fill form"
                            : "Signature only"}{" "}
                          • {t.assignment.mode}
                        </div>
                      </div>
                      <div className="text-xs font-medium text-slate-700">
                        {t.status}
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => handleDispatchTask(t.id)}
                      >
                        Dispatch
                      </Button>
                      <Button
                        onClick={() =>
                          setTasks((prev) =>
                            prev.map((entry) =>
                              entry.id === t.id
                                ? { ...entry, status: "DONE" }
                                : entry,
                            ),
                          )
                        }
                      >
                        Mark done
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => {
                  setIsTaskModalOpen(true);
                  setTaskWizardStep(1);
                  setTaskDraft({
                    id: createId(),
                    title: "New task",
                    type: "fillform",
                    formTemplateId: currentTemplateId,
                    assignment: { mode: "all", values: [] },
                    status: "PENDING",
                  });
                }}
              >
                Add task
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleDispatchAll()}
                disabled={tasks.length === 0}
              >
                Dispatch all
              </Button>
            </div>
          </div>

          {/*
                          <div
                            className="flex h-full w-full items-end justify-end gap-2 overflow-hidden px-1 text-[11px] text-slate-900"
                            style={{ lineHeight: cellLineHeight }}
                          >
                            <span className="whitespace-nowrap">
                              (Signature of Applicants with date) / 555 
5 98d
          <Button
            variant="secondary"
            onClick={() =>
              selectedField && selectedPage
                ? openSettings(selectedPage.id, selectedField)
                            </span>
                            <span className="min-w-0 flex-1 border-b border-dashed border-slate-400" />
                          </div>
                        ) : null}
                : null
            }
            disabled={!selectedField || !selectedPage}
          >
            Open settings
          </Button>
          */}

          <Button
            variant="secondary"
            onClick={() =>
              selectedField && selectedPage
                ? openSettings(selectedPage.id, selectedField)
                : null
            }
            disabled={!selectedField || !selectedPage}
          >
            Open settings
          </Button>
          {!selectedField ? (
            <p className="text-xs text-slate-500">
              Tip: drag fields anywhere on the grid and resize them in settings.
            </p>
          ) : null}
        </SurfaceCard>
      </div>

      {isSettingsOpen && settingsDraft && settingsPageId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={closeSettings}
            aria-label="Close settings"
          />
          <SurfaceCard className="relative w-full max-w-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  Field settings
                </p>
                <p className="text-xs text-slate-500">
                  Update field content, size, and validation rules.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSettings}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Close
              </button>
            </div>

            {settingsDraft.kind === "brand" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brand-college">College name</Label>
                  <Input
                    id="brand-college"
                    value={settingsDraft.collegeName}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "brand"
                          ? { ...prev, collegeName: event.target.value }
                          : prev,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-heading">Form heading</Label>
                  <Input
                    id="brand-heading"
                    value={settingsDraft.formHeading}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "brand"
                          ? { ...prev, formHeading: event.target.value }
                          : prev,
                      )
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    checked={settingsDraft.showLogo}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "brand"
                          ? { ...prev, showLogo: event.target.checked }
                          : prev,
                      )
                    }
                  />
                  Show IIT Ropar logo
                </label>
              </div>
            ) : null}

            {settingsDraft.kind === "text" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="text-content">Text content</Label>
                  <textarea
                    id="text-content"
                    value={settingsDraft.content}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "text"
                          ? { ...prev, content: event.target.value }
                          : prev,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                    rows={5}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="text-alignment">Alignment</Label>
                    <select
                      id="text-alignment"
                      value={settingsDraft.alignment}
                      onChange={(event) =>
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "text"
                            ? {
                                ...prev,
                                alignment: event.target
                                  .value as TextField["alignment"],
                              }
                            : prev,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text-width">Width</Label>
                    <select
                      id="text-width"
                      value={settingsDraft.width}
                      onChange={(event) => {
                        const width = event.target.value as FieldWidth;
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "text"
                            ? {
                                ...prev,
                                width,
                                layout: normalizeLayout({
                                  ...prev.layout,
                                  colSpan: widthBySize[width],
                                }),
                              }
                            : prev,
                        );
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                      <option value="full">Full width</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-rows">Text block height</Label>
                  <select
                    id="text-rows"
                    value={settingsDraft.rows}
                    onChange={(event) => {
                      const rows = Number(event.target.value);
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "text"
                          ? {
                              ...prev,
                              rows,
                              layout: normalizeLayout({
                                ...prev.layout,
                                rowSpan: rows,
                              }),
                            }
                          : prev,
                      );
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                  >
                    {Array.from(
                      { length: MAX_TEXT_ROWS },
                      (_, index) => index + 1,
                    ).map((value) => (
                      <option key={value} value={value}>
                        {value} rows
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {settingsDraft.kind === "input" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="input-label">Label</Label>
                  <Input
                    id="input-label"
                    value={settingsDraft.label}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "input"
                          ? { ...prev, label: event.target.value }
                          : prev,
                      )
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="input-type">Data type</Label>
                    <select
                      id="input-type"
                      value={settingsDraft.inputType}
                      onChange={(event) =>
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "input"
                            ? {
                                ...prev,
                                inputType: event.target.value as InputFieldType,
                              }
                            : prev,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email (Gmail)</option>
                      <option value="tel">Phone number</option>
                      <option value="date">Date</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-width">Width</Label>
                    <select
                      id="input-width"
                      value={settingsDraft.width}
                      onChange={(event) => {
                        const width = event.target.value as FieldWidth;
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "input"
                            ? {
                                ...prev,
                                width,
                                layout: normalizeLayout({
                                  ...prev.layout,
                                  colSpan: widthBySize[width],
                                }),
                              }
                            : prev,
                        );
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                      <option value="full">Full width</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="input-min-length">Min length</Label>
                    <Input
                      id="input-min-length"
                      type="number"
                      value={settingsDraft.minLength ?? ""}
                      onChange={(event) =>
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "input"
                            ? {
                                ...prev,
                                minLength: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              }
                            : prev,
                        )
                      }
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-max-length">Max length</Label>
                    <Input
                      id="input-max-length"
                      type="number"
                      value={settingsDraft.maxLength ?? ""}
                      onChange={(event) =>
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "input"
                            ? {
                                ...prev,
                                maxLength: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              }
                            : prev,
                        )
                      }
                      min={0}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="input-help">Helper text</Label>
                  <Input
                    id="input-help"
                    value={settingsDraft.helpText ?? ""}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "input"
                          ? { ...prev, helpText: event.target.value }
                          : prev,
                      )
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    checked={settingsDraft.required}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "input"
                          ? { ...prev, required: event.target.checked }
                          : prev,
                      )
                    }
                  />
                  Required field
                </label>
              </div>
            ) : null}

            {settingsDraft.kind === "textarea" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="textarea-label">Label</Label>
                  <Input
                    id="textarea-label"
                    value={settingsDraft.label}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "textarea"
                          ? { ...prev, label: event.target.value }
                          : prev,
                      )
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="textarea-width">Width</Label>
                    <select
                      id="textarea-width"
                      value={settingsDraft.width}
                      onChange={(event) => {
                        const width = event.target.value as FieldWidth;
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "textarea"
                            ? {
                                ...prev,
                                width,
                                layout: normalizeLayout({
                                  ...prev.layout,
                                  colSpan: widthBySize[width],
                                }),
                              }
                            : prev,
                        );
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                      <option value="full">Full width</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="textarea-rows">Text box rows</Label>
                    <select
                      id="textarea-rows"
                      value={settingsDraft.rows}
                      onChange={(event) => {
                        const rows = Number(event.target.value);
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "textarea"
                            ? {
                                ...prev,
                                rows,
                                layout: normalizeLayout({
                                  ...prev.layout,
                                  rowSpan: rows,
                                }),
                              }
                            : prev,
                        );
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((value) => (
                        <option key={value} value={value}>
                          {value} rows
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="textarea-min-length">Min length</Label>
                    <Input
                      id="textarea-min-length"
                      type="number"
                      value={settingsDraft.minLength ?? ""}
                      onChange={(event) =>
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "textarea"
                            ? {
                                ...prev,
                                minLength: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              }
                            : prev,
                        )
                      }
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="textarea-max-length">Max length</Label>
                    <Input
                      id="textarea-max-length"
                      type="number"
                      value={settingsDraft.maxLength ?? ""}
                      onChange={(event) =>
                        setSettingsDraft((prev) =>
                          prev && prev.kind === "textarea"
                            ? {
                                ...prev,
                                maxLength: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              }
                            : prev,
                        )
                      }
                      min={0}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="textarea-help">Helper text</Label>
                  <Input
                    id="textarea-help"
                    value={settingsDraft.helpText ?? ""}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "textarea"
                          ? { ...prev, helpText: event.target.value }
                          : prev,
                      )
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    checked={settingsDraft.required}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "textarea"
                          ? { ...prev, required: event.target.checked }
                          : prev,
                      )
                    }
                  />
                  Required field
                </label>
              </div>
            ) : null}

            {settingsDraft.kind === "checkbox" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="checkbox-label">Label</Label>
                  <Input
                    id="checkbox-label"
                    value={settingsDraft.label}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "checkbox"
                          ? { ...prev, label: event.target.value }
                          : prev,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkbox-width">Width</Label>
                  <select
                    id="checkbox-width"
                    value={settingsDraft.width}
                    onChange={(event) => {
                      const width = event.target.value as FieldWidth;
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "checkbox"
                          ? {
                              ...prev,
                              width,
                              layout: normalizeLayout({
                                ...prev.layout,
                                colSpan: widthBySize[width],
                              }),
                            }
                          : prev,
                      );
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                    <option value="full">Full width</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    checked={settingsDraft.defaultChecked}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev && prev.kind === "checkbox"
                          ? { ...prev, defaultChecked: event.target.checked }
                          : prev,
                      )
                    }
                  />
                  Default to checked
                </label>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeSettings}>
                Cancel
              </Button>
              <Button onClick={handleSettingsSave}>Save changes</Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {isTaskModalOpen && taskDraft ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => {
              setIsTaskModalOpen(false);
              setTaskDraft(null);
            }}
            aria-label="Close task modal"
          />
          <SurfaceCard className="relative w-full max-w-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  Create task
                </p>
                <p className="text-xs text-slate-500">
                  Define a task and who should perform it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTaskModalOpen(false);
                  setTaskDraft(null);
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Close
              </button>
            </div>

            <div>
              <div className="mb-3 text-sm font-medium">
                Step {taskWizardStep} of {taskDraft.type === "fillform" ? 3 : 2}
              </div>

              {taskWizardStep === 1 ? (
                <div className="space-y-3">
                  <Label>Task title</Label>
                  <Input
                    value={taskDraft.title ?? ""}
                    onChange={(e) =>
                      setTaskDraft((prev) =>
                        prev ? { ...prev, title: e.target.value } : prev,
                      )
                    }
                  />
                  <div>
                    <Label>Task type</Label>
                    <div className="flex gap-3 mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="task-type"
                          checked={taskDraft.type === "fillform"}
                          onChange={() =>
                            setTaskDraft((prev) =>
                              prev ? { ...prev, type: "fillform" } : prev,
                            )
                          }
                        />
                        <span className="text-sm">Fill form</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="task-type"
                          checked={taskDraft.type === "signature"}
                          onChange={() =>
                            setTaskDraft((prev) =>
                              prev ? { ...prev, type: "signature" } : prev,
                            )
                          }
                        />
                        <span className="text-sm">Signature only</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : taskWizardStep === 2 ? (
                <div className="space-y-3">
                  {taskDraft.type === "fillform" ? (
                    <>
                      <Label htmlFor="task-template-id">
                        Template id (required)
                      </Label>
                      <Input
                        id="task-template-id"
                        placeholder="Enter template id"
                        value={taskDraft.formTemplateId ?? ""}
                        onChange={(e) =>
                          setTaskDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  formTemplateId: e.target.value || null,
                                }
                              : prev,
                          )
                        }
                      />
                      <p className="text-xs text-slate-500">
                        Fill-form tasks must reference a template id.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">
                      Signature-only tasks are added directly. Continue to
                      assignment.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Assign to</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                      <input
                        type="radio"
                        name="assign-mode"
                        checked={taskDraft.assignment?.mode === "all"}
                        onChange={() =>
                          setTaskDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  assignment: { mode: "all", values: [] },
                                }
                              : prev,
                          )
                        }
                      />
                      <span className="text-sm">Everyone (all users)</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                      <input
                        type="radio"
                        name="assign-mode"
                        checked={taskDraft.assignment?.mode === "role"}
                        onChange={() =>
                          setTaskDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  assignment: { mode: "role", values: [] },
                                }
                              : prev,
                          )
                        }
                      />
                      <span className="text-sm">By role</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                      <input
                        type="radio"
                        name="assign-mode"
                        checked={taskDraft.assignment?.mode === "department"}
                        onChange={() =>
                          setTaskDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  assignment: {
                                    mode: "department",
                                    values: [],
                                  },
                                }
                              : prev,
                          )
                        }
                      />
                      <span className="text-sm">By department</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                      <input
                        type="radio"
                        name="assign-mode"
                        checked={taskDraft.assignment?.mode === "specific"}
                        onChange={() =>
                          setTaskDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  assignment: { mode: "specific", values: [] },
                                }
                              : prev,
                          )
                        }
                      />
                      <span className="text-sm">Specific users</span>
                    </label>
                  </div>

                  {taskDraft.assignment?.mode === "role" ? (
                    <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4">
                      <div className="space-y-1">
                        <Label>Select roles</Label>
                        <p className="text-xs text-slate-500">
                          Tap + to add or − to remove roles assigned to this
                          task.
                        </p>
                      </div>
                      {renderSelectableGrid(
                        taskRoleOptions,
                        selectedTaskAssignmentValues,
                      )}
                      {renderSelectedChips(selectedTaskRoleLabels)}
                    </div>
                  ) : null}

                  {taskDraft.assignment?.mode === "department" ? (
                    <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4">
                      <div className="space-y-1">
                        <Label>Select departments</Label>
                        <p className="text-xs text-slate-500">
                          Tap + to add or − to remove departments assigned to
                          this task.
                        </p>
                      </div>
                      {renderSelectableGrid(
                        taskDepartmentOptions,
                        selectedTaskAssignmentValues,
                      )}
                      {renderSelectedChips(selectedTaskDepartmentLabels)}
                    </div>
                  ) : null}

                  {taskDraft.assignment?.mode === "specific" ? (
                    <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4">
                      <div className="space-y-1">
                        <Label>Select users</Label>
                        <p className="text-xs text-slate-500">
                          Tap + to add or − to remove specific users assigned to
                          this task.
                        </p>
                      </div>
                      {renderSelectableGrid(
                        taskUserOptions,
                        selectedTaskAssignmentValues,
                      )}
                      {renderSelectedChips(
                        selectedTaskUserOptions.map(
                          (option) =>
                            `${option.label}${option.meta ? ` · ${option.meta}` : ""}`,
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {taskWizardStep > 1 ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (
                      taskDraft.type === "signature" &&
                      taskWizardStep === 3
                    ) {
                      setTaskWizardStep(1);
                      return;
                    }
                    setTaskWizardStep((s) => Math.max(1, s - 1));
                  }}
                >
                  Back
                </Button>
              ) : null}
              {taskWizardStep < 3 ? (
                <Button
                  onClick={() => {
                    if (
                      taskWizardStep === 1 &&
                      taskDraft.type === "signature"
                    ) {
                      setTaskWizardStep(3);
                      return;
                    }

                    if (taskWizardStep === 2 && taskDraft.type === "fillform") {
                      if (!taskDraft.formTemplateId?.trim()) {
                        setStatusTone("error");
                        setStatusMessage(
                          "Template id is required for fill-form tasks.",
                        );
                        return;
                      }
                    }

                    setTaskWizardStep((s) => Math.min(3, s + 1));
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (taskDraft.type === "fillform") {
                      if (!taskDraft.formTemplateId?.trim()) {
                        setStatusTone("error");
                        setStatusMessage(
                          "Template id is required for fill-form tasks.",
                        );
                        return;
                      }
                    }

                    if (
                      taskDraft.assignment?.mode !== "all" &&
                      (taskDraft.assignment?.values?.length ?? 0) === 0
                    ) {
                      setStatusTone("error");
                      setStatusMessage(
                        "Please select at least one assignment target.",
                      );
                      return;
                    }

                    // finalize and save
                    const finalTask: FormTask = {
                      id: (taskDraft.id as string) ?? createId(),
                      title: (taskDraft.title as string) ?? "Task",
                      type: (taskDraft.type as TaskType) ?? "fillform",
                      formTemplateId: taskDraft.formTemplateId ?? null,
                      assignment: taskDraft.assignment ?? {
                        mode: "all",
                        values: [],
                      },
                      status: "PENDING",
                    };
                    setTasks((prev) => [...prev, finalTask]);
                    setIsTaskModalOpen(false);
                    setTaskDraft(null);
                    setStatusTone("success");
                    setStatusMessage("Task created.");
                  }}
                >
                  Save task
                </Button>
              )}
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {isVisibilityOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setIsVisibilityOpen(false)}
            aria-label="Close visibility"
          />
          <SurfaceCard className="relative w-full max-w-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  Visible to roles
                </p>
                <p className="text-xs text-slate-500">
                  Select which roles can see this form.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsVisibilityOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Close
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {roleOptions.map((role) => {
                const checked = visibilityRoles.includes(role.key);
                return (
                  <label
                    key={role.key}
                    className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm font-semibold text-slate-800"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      checked={checked}
                      onChange={(event) => {
                        const isChecked = event.target.checked;
                        setVisibilityRoles((prev) => {
                          if (isChecked) {
                            return prev.includes(role.key)
                              ? prev
                              : [...prev, role.key];
                          }
                          return prev.filter((key) => key !== role.key);
                        });
                      }}
                    />
                    {role.label}
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsVisibilityOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setIsVisibilityOpen(false);
                  await handleSave(visibilityRoles, "published");
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save form"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}
    </div>
  );
};
