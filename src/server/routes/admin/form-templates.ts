import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

const fieldWidthSchema = z.enum(["short", "medium", "long", "full"]);

const layoutSchema = z.object({
  col: z.number().int().min(1),
  row: z.number().int().min(1),
  colSpan: z.number().int().min(1),
  rowSpan: z.number().int().min(1),
});

const textFieldSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("text"),
  content: z.string(),
  alignment: z.enum(["left", "center", "right"]),
  rows: z.number().int().min(1).max(12),
  width: fieldWidthSchema,
  layout: layoutSchema,
});

const inputFieldSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("input"),
  label: z.string().optional().default(""),
  inputType: z.enum(["text", "email", "tel", "date", "number"]),
  required: z.boolean().optional().default(false),
  minLength: z.number().int().min(0).nullable().optional(),
  maxLength: z.number().int().min(1).nullable().optional(),
  helpText: z.string().nullable().optional(),
  width: fieldWidthSchema,
  layout: layoutSchema,
});

const textAreaFieldSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("textarea"),
  label: z.string().optional().default(""),
  value: z.string().optional().default(""),
  required: z.boolean().optional().default(false),
  minLength: z.number().int().min(0).nullable().optional(),
  maxLength: z.number().int().min(1).nullable().optional(),
  helpText: z.string().nullable().optional(),
  rows: z.number().int().min(1).max(12),
  width: fieldWidthSchema,
  layout: layoutSchema,
});

const checkboxFieldSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("checkbox"),
  label: z.string().optional().default(""),
  defaultChecked: z.boolean().optional().default(false),
  width: fieldWidthSchema,
  layout: layoutSchema,
});

const signatureFieldSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("signature"),
  layout: layoutSchema,
});

const brandFieldSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("brand"),
  collegeName: z.string().min(1),
  formHeading: z.string().optional().default(""),
  showLogo: z.boolean().optional().default(true),
  layout: layoutSchema,
});

const pageSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable().optional(),
  fields: z.array(
    z.discriminatedUnion("kind", [
      brandFieldSchema,
      textFieldSchema,
      inputFieldSchema,
      textAreaFieldSchema,
      checkboxFieldSchema,
      signatureFieldSchema,
    ]),
  ),
});

const builderSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  visibilityRoles: z.array(z.string()).optional(),
  grid: z
    .object({
      unit: z.number().int().min(1),
      unitLabel: z.string().optional(),
      columns: z.number().int().min(1).optional(),
      rows: z.number().int().min(1).optional(),
    })
    .optional(),
  pages: z.array(pageSchema).min(1),
});

const createSchema = z.object({
  name: z.string().min(3),
  description: z.string().nullable().optional(),
  schema: builderSchema,
});

type HandlerResult = {
  status: number;
  body: { ok: boolean; message: string; data?: { id: string } };
};

export const createFormTemplateHandler = async (
  payload: unknown,
  actorId: string,
): Promise<HandlerResult> => {
  try {
    const data = createSchema.parse(payload);
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      return {
        status: 400,
        body: { ok: false, message: "Form name is required." },
      };
    }

    const totalFields = data.schema.pages.reduce(
      (sum, page) => sum + page.fields.length,
      0,
    );
    const totalNonBrandFields = data.schema.pages.reduce(
      (sum, page) =>
        sum + page.fields.filter((field) => field.kind !== "brand").length,
      0,
    );

    if (totalFields === 0 || totalNonBrandFields === 0) {
      return {
        status: 400,
        body: { ok: false, message: "Add at least one field before saving." },
      };
    }

    const gridColumns = data.schema.grid?.columns ?? null;
    const gridRows = data.schema.grid?.rows ?? null;

    for (const page of data.schema.pages) {
      for (const field of page.fields) {
        if (
          (field.kind === "input" || field.kind === "textarea") &&
          field.minLength != null &&
          field.maxLength != null &&
          field.maxLength < field.minLength
        ) {
          return {
            status: 400,
            body: { ok: false, message: "Max length must be >= min length." },
          };
        }

        if (gridColumns != null && gridRows != null) {
          const colEnd = field.layout.col + field.layout.colSpan - 1;
          const rowEnd = field.layout.row + field.layout.rowSpan - 1;
          if (
            field.layout.col < 1 ||
            field.layout.row < 1 ||
            colEnd > gridColumns ||
            rowEnd > gridRows
          ) {
            return {
              status: 400,
              body: {
                ok: false,
                message: "One or more fields are outside the grid bounds.",
              },
            };
          }
        }
      }
    }

    const description = data.description?.trim();
    const schema = {
      ...data.schema,
      title: data.schema.title?.trim() || trimmedName,
      description: data.schema.description?.trim() || null,
    };

    const formTemplateModel = (prisma as unknown as { formTemplate?: unknown })
      .formTemplate as
      | undefined
      | {
          create: (args: unknown) => Promise<{ id: string }>;
        };

    if (!formTemplateModel?.create) {
      return {
        status: 500,
        body: {
          ok: false,
          message:
            "Form templates database client is not initialized. Run `npm run prisma:generate`.",
        },
      };
    }

    const record = await formTemplateModel.create({
      data: {
        name: trimmedName,
        description: description && description.length > 0 ? description : null,
        schema,
        createdById: actorId,
      },
    });

    return {
      status: 201,
      body: {
        ok: true,
        message: "Form saved successfully.",
        data: { id: record.id },
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 400,
        body: { ok: false, message: "Invalid form payload." },
      };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021") {
        return {
          status: 500,
          body: {
            ok: false,
            message:
              "FormTemplate table is missing in the database. Run `npm run db:push` (or migrations) and try again.",
          },
        };
      }
    }

    console.error("createFormTemplateHandler failed", error);

    return {
      status: 500,
      body: {
        ok: false,
        message: "Unable to save the form.",
      },
    };
  }
};
