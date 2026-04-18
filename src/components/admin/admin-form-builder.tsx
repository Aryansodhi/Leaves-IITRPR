"use client";

import Image from "next/image";
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

type DragState =
  | {
      source: "palette";
      kind: Exclude<FieldKind, "brand">;
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

const GRID_UNIT_MM = 6;
const GRID_COLS = 30;
const GRID_ROWS = 45;
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
  kind: Exclude<FieldKind, "brand">;
  title: string;
  description: string;
  preset?: { inputType?: InputFieldType };
}> = [
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

const createPage = (index: number): BuilderPage => ({
  id: createId(),
  title: `Page ${index + 1}`,
  fields: [createBrandField()],
});

const createField = (
  kind: Exclude<FieldKind, "brand">,
  preset?: { inputType?: InputFieldType },
): BuilderField => {
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
  const [formName, setFormName] = useState("New form");
  const [formDescription, setFormDescription] = useState("");
  const [pages, setPages] = useState<BuilderPage[]>([createPage(0)]);
  const [elementSearch, setElementSearch] = useState("");
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const [visibilityRoles, setVisibilityRoles] = useState<RoleOptionKey[]>(
    roleOptions.map((role) => role.key),
  );
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
  const gridRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const textAreaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const [editingTextAreaId, setEditingTextAreaId] = useState<string | null>(
    null,
  );
  const [resizeState, setResizeState] = useState<ResizeState>(null);

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
    setPages((prev) => [...prev, createPage(prev.length)]);
  };

  const handleRemovePage = (pageId: string) => {
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
    const newField = createField(item.kind, item.preset);
    const targetPage = pages.find((page) => page.id === pageId);
    const startRow =
      item.kind === "signature"
        ? GRID_ROWS
        : targetPage?.fields.find((field) => field.kind === "brand")
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

  const handleSave = async (roles: RoleOptionKey[]) => {
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
    if (totalFields === 0 || totalNonBrand === 0) {
      setStatusTone("error");
      setStatusMessage("Add at least one field before saving.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/form-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: formDescription.trim() || null,
          schema: {
            version: 3,
            title: trimmedName,
            description: formDescription.trim() || null,
            visibilityRoles: roles,
            grid: {
              unit: GRID_UNIT_MM,
              unitLabel: "mm",
              columns: GRID_COLS,
              rows: GRID_ROWS,
            },
            pages,
          },
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok) {
        setStatusTone("error");
        setStatusMessage(data.message ?? "Unable to save the form.");
        return;
      }

      setStatusTone("success");
      setStatusMessage(data.message ?? "Form saved successfully.");
    } catch (error) {
      console.error("Form save failed", error);
      setStatusTone("error");
      setStatusMessage("Something went wrong while saving the form.");
    } finally {
      setIsSaving(false);
    }
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
              onClick={() => setIsVisibilityOpen(true)}
              disabled={isSaving}
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
                  {pages.length > 1 ? (
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
                          field.kind === "textarea"
                            ? editingTextAreaId === field.id
                              ? "cursor-text"
                              : "cursor-pointer"
                            : field.kind === "brand"
                              ? "cursor-default"
                              : "cursor-grab rounded-md active:cursor-grabbing",
                          selectedItem?.fieldId === field.id
                            ? "bg-white/95 ring-1 ring-slate-400"
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
                        {field.kind !== "brand" && field.kind !== "textarea" ? (
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

                            <div className="h-full w-full border border-dashed border-slate-500/80">
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
                    {[1, 2, 3, 4, 5, 6].map((value) => (
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
                  await handleSave(visibilityRoles);
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
