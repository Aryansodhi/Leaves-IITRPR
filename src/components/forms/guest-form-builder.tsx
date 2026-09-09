"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  GripVertical,
  Plus,
  Trash2,
  Type,
  TextCursorInput,
  AlignLeft,
  CheckSquare,
  PenTool,
  Image as ImageIcon,
  X,
} from "lucide-react";

import { useGuest } from "@/components/auth/guest-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ───────────────────── Types ───────────────────── */

type FieldKind =
  | "brand"
  | "text"
  | "input"
  | "textarea"
  | "checkbox"
  | "signature";

type DemoField = {
  id: string;
  kind: FieldKind;
  label: string;
};

type PaletteItem = {
  kind: FieldKind;
  label: string;
  icon: typeof Type;
};

/* ───────────────────── Constants ───────────────────── */

const PALETTE: PaletteItem[] = [
  { kind: "brand", label: "Brand / Header", icon: ImageIcon },
  { kind: "text", label: "Static Text", icon: Type },
  { kind: "input", label: "Text Input", icon: TextCursorInput },
  { kind: "textarea", label: "Text Area", icon: AlignLeft },
  { kind: "checkbox", label: "Checkbox", icon: CheckSquare },
  { kind: "signature", label: "Signature", icon: PenTool },
];

const DEFAULT_LABELS: Record<FieldKind, string> = {
  brand: "IIT Ropar — Leave Management",
  text: "Enter your static text here.",
  input: "Text Field",
  textarea: "Long Answer",
  checkbox: "Agree to terms",
  signature: "Applicant Signature",
};

let nextId = 1;
const makeId = () => `gf-${nextId++}`;

/* ───────────────────── Component ───────────────────── */

export const GuestFormBuilder = ({ onClose }: { onClose: () => void }) => {
  const { promptLogin } = useGuest();
  const [fields, setFields] = useState<DemoField[]>([]);
  const [formName, setFormName] = useState("");
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [draggedKind, setDraggedKind] = useState<FieldKind | null>(null);
  const [reorderIdx, setReorderIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  /* ── Palette drag handlers ── */
  const onPaletteDragStart = (e: DragEvent, kind: FieldKind) => {
    setDraggedKind(kind);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", kind);
  };

  /* ── Canvas drag handlers ── */
  const onCanvasDragOver = useCallback(
    (e: DragEvent, idx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = draggedKind ? "copy" : "move";
      setDragOverIdx(idx);
    },
    [draggedKind],
  );

  const onCanvasDrop = useCallback(
    (e: DragEvent, dropIdx: number) => {
      e.preventDefault();
      setDragOverIdx(null);

      if (reorderIdx !== null) {
        // Reorder existing field
        setFields((prev) => {
          const updated = [...prev];
          const [moved] = updated.splice(reorderIdx, 1);
          updated.splice(
            dropIdx > reorderIdx ? dropIdx - 1 : dropIdx,
            0,
            moved,
          );
          return updated;
        });
        setReorderIdx(null);
        return;
      }

      const kind = e.dataTransfer.getData("text/plain") as FieldKind;
      if (!kind) return;

      const newField: DemoField = {
        id: makeId(),
        kind,
        label: DEFAULT_LABELS[kind],
      };
      setFields((prev) => {
        const updated = [...prev];
        updated.splice(dropIdx, 0, newField);
        return updated;
      });
      setDraggedKind(null);
    },
    [reorderIdx],
  );

  const onCanvasDragEnd = () => {
    setDragOverIdx(null);
    setDraggedKind(null);
    setReorderIdx(null);
  };

  /* ── Field reorder drag ── */
  const onFieldDragStart = (e: DragEvent, idx: number) => {
    setReorderIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "reorder");
  };

  /* ── Field actions ── */
  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const updateLabel = (id: string, label: string) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
  };

  const addFieldFromPalette = (kind: FieldKind) => {
    setFields((prev) => [
      ...prev,
      { id: makeId(), kind, label: DEFAULT_LABELS[kind] },
    ]);
  };

  /* ── Create handler ── */
  const handleCreate = () => {
    promptLogin(
      "Sign in to create and publish forms. The form builder requires an authenticated admin session.",
    );
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:px-6 sm:py-8">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        aria-label="Close builder"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-slate-200/70 bg-white shadow-2xl sm:h-[85vh] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">
              Form Builder
            </h2>
            <p className="text-xs text-slate-500">
              Drag fields from the palette to build your form. This is a demo —
              sign in to save.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Palette */}
          <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Field Palette
            </p>
            <div className="space-y-2">
              {PALETTE.map((item) => (
                <div
                  key={item.kind}
                  draggable
                  onDragStart={(e) => onPaletteDragStart(e, item.kind)}
                  onDragEnd={onCanvasDragEnd}
                  className="group flex cursor-grab items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing"
                >
                  <item.icon className="h-4 w-4 text-slate-400 transition group-hover:text-slate-600" />
                  <span className="flex-1 truncate">{item.label}</span>
                  <Plus
                    className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-slate-500 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      addFieldFromPalette(item.kind);
                    }}
                  />
                </div>
              ))}
            </div>
          </aside>

          {/* Canvas */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Form name */}
            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Form Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Leave Application Form"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>

            {/* Drop zone */}
            <div ref={canvasRef} className="min-h-[200px] space-y-0">
              {fields.length === 0 && (
                <div
                  className="flex min-h-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIdx(0);
                  }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={(e) => onCanvasDrop(e, 0)}
                >
                  <div className="space-y-2 px-6">
                    <p className="text-sm font-medium text-slate-400">
                      Drag fields here from the palette
                    </p>
                    <p className="text-xs text-slate-400">
                      or click the <Plus className="inline h-3 w-3" /> icon to
                      add
                    </p>
                  </div>
                </div>
              )}

              {fields.map((field, idx) => (
                <div key={field.id}>
                  {/* Drop indicator */}
                  <div
                    className={cn(
                      "h-1 rounded-full transition-all duration-150",
                      dragOverIdx === idx
                        ? "my-1 bg-slate-900"
                        : "bg-transparent",
                    )}
                    onDragOver={(e) => onCanvasDragOver(e, idx)}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={(e) => onCanvasDrop(e, idx)}
                  />

                  {/* Field card */}
                  <div
                    draggable
                    onDragStart={(e) => onFieldDragStart(e, idx)}
                    onDragEnd={onCanvasDragEnd}
                    className="group flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm transition hover:border-slate-300"
                  >
                    <div className="mt-0.5 cursor-grab text-slate-300 transition group-hover:text-slate-500 active:cursor-grabbing">
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <div className="flex-1 space-y-2">
                      {/* Render preview based on kind */}
                      <FieldPreview
                        field={field}
                        onLabelChange={(val) => updateLabel(field.id, val)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeField(field.id)}
                      className="mt-0.5 rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Final drop zone */}
              {fields.length > 0 && (
                <div
                  className={cn(
                    "h-6 rounded-full transition-all duration-150",
                    dragOverIdx === fields.length
                      ? "my-1 h-1 bg-slate-900"
                      : "bg-transparent",
                  )}
                  onDragOver={(e) => onCanvasDragOver(e, fields.length)}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={(e) => onCanvasDrop(e, fields.length)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-400">
            {fields.length} field{fields.length !== 1 ? "s" : ""} added
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Form</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────── Field Previews ───────────────────── */

const FieldPreview = ({
  field,
  onLabelChange,
}: {
  field: DemoField;
  onLabelChange: (val: string) => void;
}) => {
  switch (field.kind) {
    case "brand":
      return (
        <div className="space-y-1">
          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Brand / Header
          </span>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="w-full rounded-lg border-0 bg-transparent px-0 text-base font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
            placeholder="College name / Form heading"
          />
        </div>
      );
    case "text":
      return (
        <div className="space-y-1">
          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Static Text
          </span>
          <textarea
            value={field.label}
            onChange={(e) => onLabelChange(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border-0 bg-transparent px-0 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-0"
            placeholder="Enter static text content…"
          />
        </div>
      );
    case "input":
      return (
        <div className="space-y-1.5">
          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Text Input
          </span>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="w-full rounded-lg border-0 bg-transparent px-0 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
            placeholder="Field label"
          />
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
            User input will appear here
          </div>
        </div>
      );
    case "textarea":
      return (
        <div className="space-y-1.5">
          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Text Area
          </span>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="w-full rounded-lg border-0 bg-transparent px-0 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
            placeholder="Field label"
          />
          <div className="h-16 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
            Long-form text area
          </div>
        </div>
      );
    case "checkbox":
      return (
        <div className="space-y-1">
          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Checkbox
          </span>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded border border-slate-300 bg-white" />
            <input
              type="text"
              value={field.label}
              onChange={(e) => onLabelChange(e.target.value)}
              className="flex-1 rounded-lg border-0 bg-transparent px-0 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-0"
              placeholder="Checkbox label"
            />
          </div>
        </div>
      );
    case "signature":
      return (
        <div className="space-y-1.5">
          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Signature
          </span>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="w-full rounded-lg border-0 bg-transparent px-0 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
            placeholder="Signature label"
          />
          <div className="flex h-14 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
            Signature area
          </div>
        </div>
      );
    default:
      return null;
  }
};
