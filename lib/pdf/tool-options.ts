import { z } from "zod";

import type { ToolId } from "./tools";

/**
 * Declarative form configuration for each implemented tool.
 *
 * The same schema validates input in the browser (instant feedback) and in the
 * API route (authoritative). Fields are rendered generically by
 * `ToolOptionsPanel`, so adding a tool does not require new form components.
 */

export type ToolValue = string | number | boolean;
export type ToolValues = Record<string, ToolValue>;

type FieldBase = {
  name: string;
  label: string;
  hint?: string;
};

export type SelectField = FieldBase & {
  kind: "select";
  options: ReadonlyArray<{ value: string; label: string }>;
};

export type SegmentedField = FieldBase & {
  kind: "segmented";
  options: ReadonlyArray<{ value: string; label: string }>;
};

export type SliderField = FieldBase & {
  kind: "slider";
  min: number;
  max: number;
  step: number;
  unit?: string;
};

export type SwitchField = FieldBase & {
  kind: "switch";
};

export type TextField = FieldBase & {
  kind: "text";
  placeholder?: string;
};

export type OptionField = SelectField | SegmentedField | SliderField | SwitchField | TextField;

export type ToolFormConfig = {
  fields: readonly OptionField[];
  defaults: ToolValues;
  schema: z.ZodType<ToolValues>;
};

const pageNumbersPattern = /^(all|[1-9]\d{0,4}(-[1-9]\d{0,4})?(,[1-9]\d{0,4}(-[1-9]\d{0,4})?)*)$/i;

/** Page numbers are 1-based, so a range must not run backwards. */
function hasForwardRange(selection: string): boolean {
  if (selection.toLowerCase() === "all") {
    return true;
  }

  return selection.split(",").every((part) => {
    const [start, end] = part.split("-");
    return end === undefined || Number(start) <= Number(end);
  });
}

const mergeSchema = z.object({
  sortType: z.enum([
    "orderProvided",
    "byFileName",
    "byDateModified",
    "byDateCreated",
    "byPDFTitle",
  ]),
  generateToc: z.boolean(),
});

const splitSchema = z.object({
  pageNumbers: z
    .string()
    .trim()
    .min(1, "Enter at least one page number, a range, or 'all'.")
    .max(500, "The page selection is too long.")
    .regex(pageNumbersPattern, "Use page numbers or ranges such as 3, 2,5-9, or 'all'.")
    .refine(hasForwardRange, "Ranges must count upwards, such as 2-9."),
});

const compressSchema = z.object({
  optimizeLevel: z.number().int().min(1).max(9),
  grayscale: z.boolean(),
  linearize: z.boolean(),
});

const rotateSchema = z.object({
  angle: z.coerce
    .number()
    .refine((value) => [0, 90, 180, 270].includes(value), "Choose 90, 180 or 270 degrees."),
});

const jpgToPdfSchema = z.object({
  fitOption: z.enum(["fillPage", "fitDocumentToImage", "fitDocumentToPage", "maintainAspectRatio"]),
  colorType: z.enum(["color", "greyscale", "blackwhite"]),
  autoRotate: z.boolean(),
});

const pdfToJpgSchema = z.object({
  imageFormat: z.enum(["jpeg", "png", "webp"]),
  dpi: z.coerce.number().int().min(72).max(600),
  singleOrMultiple: z.enum(["single", "multiple"]),
  colorType: z.enum(["color", "greyscale", "blackwhite"]),
});

const COLOR_OPTIONS = [
  { value: "color", label: "Colour" },
  { value: "greyscale", label: "Greyscale" },
  { value: "blackwhite", label: "Black & white" },
] as const;

export const TOOL_FORMS = {
  "merge-pdf": {
    fields: [
      {
        kind: "select",
        name: "sortType",
        label: "Merge order",
        hint: "Custom order follows the list exactly. Other options sort by file metadata.",
        options: [
          { value: "orderProvided", label: "Custom order (as listed)" },
          { value: "byFileName", label: "File name" },
          { value: "byDateModified", label: "Date modified" },
          { value: "byDateCreated", label: "Date created" },
          { value: "byPDFTitle", label: "PDF title" },
        ],
      },
      {
        kind: "switch",
        name: "generateToc",
        label: "Generate table of contents",
        hint: "Uses each input filename as a chapter entry.",
      },
    ],
    defaults: { sortType: "orderProvided", generateToc: false },
    schema: mergeSchema,
  },
  "split-pdf": {
    fields: [
      {
        kind: "text",
        name: "pageNumbers",
        label: "Split after pages",
        placeholder: "all, or 3, or 2,5-9",
        hint: "The document is cut after each page listed. Use 'all' for one file per page.",
      },
    ],
    defaults: { pageNumbers: "all" },
    schema: splitSchema,
  },
  "compress-pdf": {
    fields: [
      {
        kind: "slider",
        name: "optimizeLevel",
        label: "Compression strength",
        hint: "1 keeps the most quality. 9 produces the smallest file.",
        min: 1,
        max: 9,
        step: 1,
      },
      {
        kind: "switch",
        name: "grayscale",
        label: "Convert to grayscale",
        hint: "Smaller output, useful for text-only documents.",
      },
      {
        kind: "switch",
        name: "linearize",
        label: "Optimise for fast web view",
        hint: "Linearized PDFs start rendering before the full file downloads.",
      },
    ],
    defaults: { optimizeLevel: 5, grayscale: false, linearize: false },
    schema: compressSchema,
  },
  "rotate-pdf": {
    fields: [
      {
        kind: "segmented",
        name: "angle",
        label: "Rotation",
        hint: "Applied clockwise to every page.",
        options: [
          { value: "90", label: "90°" },
          { value: "180", label: "180°" },
          { value: "270", label: "270°" },
        ],
      },
    ],
    defaults: { angle: 90 },
    schema: rotateSchema,
  },
  "jpg-to-pdf": {
    fields: [
      {
        kind: "select",
        name: "fitOption",
        label: "Image fit",
        options: [
          { value: "fillPage", label: "Fill the page" },
          { value: "fitDocumentToImage", label: "Page matches image" },
          { value: "fitDocumentToPage", label: "Image fits inside page" },
          { value: "maintainAspectRatio", label: "Keep aspect ratio" },
        ],
      },
      {
        kind: "select",
        name: "colorType",
        label: "Colour",
        options: [...COLOR_OPTIONS],
      },
      {
        kind: "switch",
        name: "autoRotate",
        label: "Auto-rotate images",
        hint: "Let the engine choose the best orientation for each page.",
      },
    ],
    defaults: { fitOption: "fillPage", colorType: "color", autoRotate: false },
    schema: jpgToPdfSchema,
  },
  "pdf-to-jpg": {
    fields: [
      {
        kind: "select",
        name: "imageFormat",
        label: "Image format",
        options: [
          { value: "jpeg", label: "JPG" },
          { value: "png", label: "PNG" },
          { value: "webp", label: "WebP" },
        ],
      },
      {
        kind: "select",
        name: "dpi",
        label: "Resolution",
        hint: "Higher resolution means larger images.",
        options: [
          { value: "96", label: "96 DPI — screen" },
          { value: "150", label: "150 DPI — balanced" },
          { value: "300", label: "300 DPI — print" },
          { value: "600", label: "600 DPI — maximum" },
        ],
      },
      {
        kind: "segmented",
        name: "singleOrMultiple",
        label: "Output",
        options: [
          { value: "multiple", label: "One image per page" },
          { value: "single", label: "Single tall image" },
        ],
      },
      {
        kind: "select",
        name: "colorType",
        label: "Colour",
        options: [...COLOR_OPTIONS],
      },
    ],
    defaults: { imageFormat: "jpeg", dpi: 300, singleOrMultiple: "multiple", colorType: "color" },
    schema: pdfToJpgSchema,
  },
} as const satisfies Partial<Record<ToolId, ToolFormConfig>>;

export type ImplementedToolId = keyof typeof TOOL_FORMS;

export function hasToolForm(toolId: string): toolId is ImplementedToolId {
  return toolId in TOOL_FORMS;
}

export function getToolForm(toolId: string): ToolFormConfig | undefined {
  return hasToolForm(toolId) ? (TOOL_FORMS[toolId] as ToolFormConfig) : undefined;
}

/**
 * Reads option values from multipart form data using the field declarations,
 * applying defaults for omitted fields.
 */
export function readToolValues(form: FormData, config: ToolFormConfig): ToolValues {
  const values: ToolValues = { ...config.defaults };

  for (const field of config.fields) {
    const raw = form.get(field.name);
    if (raw === null || typeof raw !== "string") continue;

    if (field.kind === "switch") {
      values[field.name] = raw === "true" || raw === "on" || raw === "1";
      continue;
    }

    if (field.kind === "slider" || field.name === "dpi" || field.name === "angle") {
      const parsed = Number(raw);
      values[field.name] = Number.isFinite(parsed) ? parsed : raw;
      continue;
    }

    values[field.name] = raw;
  }

  return values;
}

export type ValidationResult =
  { success: true; values: ToolValues } | { success: false; message: string; field?: string };

export function validateToolValues(config: ToolFormConfig, values: ToolValues): ValidationResult {
  const result = config.schema.safeParse(values);

  if (result.success) {
    return { success: true, values: result.data };
  }

  const issue = result.error.issues[0];
  return {
    success: false,
    message: issue?.message ?? "Some settings are not valid.",
    field: issue?.path.join(".") || undefined,
  };
}
