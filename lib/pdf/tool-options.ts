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
  /** Only render (and require server-side) this field when another value matches. */
  showWhen?: {
    field: string;
    equals: readonly ToolValue[];
  };
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

export type PasswordField = FieldBase & {
  kind: "password";
  placeholder?: string;
};

export type TextareaField = FieldBase & {
  kind: "textarea";
  placeholder?: string;
  rows?: number;
};

export type OptionField =
  | SelectField
  | SegmentedField
  | SliderField
  | SwitchField
  | TextField
  | PasswordField
  | TextareaField;

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

function pageSelection(): z.ZodString {
  return z
    .string()
    .trim()
    .min(1, "Enter at least one page number, a range, or 'all'.")
    .max(500, "The page selection is too long.")
    .regex(pageNumbersPattern, "Use page numbers or ranges such as 3, 2,5-9, or 'all'.")
    .refine(hasForwardRange, "Ranges must count upwards, such as 2-9.");
}

const splitSchema = z.object({
  pageNumbers: pageSelection(),
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

const removePagesSchema = z.object({
  pageNumbers: pageSelection().refine(
    (value) => value.toLowerCase() !== "all",
    "List the pages to remove; 'all' would leave an empty document.",
  ),
});

const extractPagesSchema = z.object({
  pageNumbers: pageSelection(),
});

const REARRANGE_MODES = [
  "CUSTOM",
  "REVERSE_ORDER",
  "DUPLEX_SORT",
  "BOOKLET_SORT",
  "SIDE_STITCH_BOOKLET_SORT",
  "ODD_EVEN_SPLIT",
  "REMOVE_FIRST",
  "REMOVE_LAST",
  "REMOVE_FIRST_AND_LAST",
  "DUPLICATE",
] as const;

const organizeSchema = z
  .object({
    customMode: z.enum(REARRANGE_MODES),
    pageNumbers: z.string().trim().max(500),
  })
  .superRefine((values, ctx) => {
    if (values.customMode === "CUSTOM") {
      const parsed = pageSelection().safeParse(values.pageNumbers);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          path: ["pageNumbers"],
          message: parsed.error.issues[0]?.message ?? "Enter the new page order.",
        });
      }
    }

    if (values.customMode === "DUPLICATE" && !/^([1-9]|10)$/.test(values.pageNumbers)) {
      ctx.addIssue({
        code: "custom",
        path: ["pageNumbers"],
        message: "Enter how many copies to make (1-10).",
      });
    }
  });

const pdfToWordSchema = z.object({
  outputFormat: z.enum(["docx", "doc", "odt"]),
  ocrBeforeConversion: z.boolean(),
  languages: z.enum(["eng", "deu", "fra", "por", "chi_sim"]),
});

const pdfToPresentationSchema = z.object({
  outputFormat: z.enum(["pptx", "ppt", "odp"]),
});

const pdfToPdfaSchema = z.object({
  outputFormat: z.enum(["pdfa-2b", "pdfa-1", "pdfa-3b", "pdfx"]),
  strict: z.boolean(),
});

const htmlToPdfSchema = z.object({
  zoom: z.coerce.number().min(0.5).max(3),
});

const watermarkSchema = z.object({
  watermarkText: z.string().trim().min(1, "Enter watermark text.").max(200),
  fontSize: z.coerce.number().int().min(8).max(144),
  rotation: z.coerce.number().int().min(-180).max(180),
  opacity: z.coerce.number().min(0.05).max(1),
  customColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour such as #d3d3d3."),
});

const pageNumberSchema = z.object({
  pageNumbers: pageSelection(),
  fontType: z.enum(["helvetica", "courier", "times"]),
  position: z.coerce.number().int().min(1).max(9),
  customText: z.string().trim().min(1, "Enter the number format.").max(100),
  startingNumber: z.coerce.number().int().min(0).max(99_999),
  fontSize: z.coerce.number().int().min(8).max(48),
  fontColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour such as #000000."),
});

const cropSchema = z
  .object({
    autoCrop: z.boolean(),
    pageNumbers: pageSelection(),
    x: z.coerce.number().min(0).max(10_000),
    y: z.coerce.number().min(0).max(10_000),
    width: z.coerce.number().min(0).max(10_000),
    height: z.coerce.number().min(0).max(10_000),
  })
  .superRefine((values, ctx) => {
    if (!values.autoCrop && (values.width <= 0 || values.height <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["width"],
        message: "Enter a crop width and height, or enable auto-crop.",
      });
    }
  });

const removePasswordSchema = z.object({
  password: z.string().max(200),
  removeAll: z.boolean(),
});

const addPasswordSchema = z.object({
  password: z.string().trim().min(1, "Enter a password.").max(100),
  ownerPassword: z.string().trim().max(100),
  keyLength: z.enum(["256", "128", "40"]),
  preventPrinting: z.boolean(),
  preventModify: z.boolean(),
  preventExtractContent: z.boolean(),
});

const ocrSchema = z.object({
  languages: z.enum(["eng", "deu", "fra", "por", "chi_sim"]),
  ocrType: z.enum(["skip-text", "force-ocr"]),
  deskew: z.boolean(),
  rotatePages: z.boolean(),
  clean: z.boolean(),
});

const redactSchema = z.object({
  listOfText: z
    .string()
    .trim()
    .min(1, "Enter at least one word or phrase to redact.")
    .max(2_000),
  useRegex: z.boolean(),
  wholeWordSearch: z.boolean(),
  caseSensitive: z.boolean(),
  redactColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour such as #000000."),
});

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour such as #000000.");

function isJsonObject(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

const pipelineStepSchema = z.object({
  operation: z
    .string()
    .trim()
    .regex(/^\/api\/v1\//, "Each operation must be a Stirling endpoint starting with /api/v1/."),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

const pipelineConfigSchema = z.object({
  name: z.string().trim().min(1, "Give the workflow a name.").max(80),
  pipeline: z
    .array(pipelineStepSchema)
    .min(1, "Add at least one operation to the workflow.")
    .max(20, "A workflow can contain up to 20 operations."),
});

export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;

/** Parses and validates the workflow JSON from the textarea. */
export function parsePipelineConfig(value: string): PipelineConfig | null {
  try {
    const parsed = pipelineConfigSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const editPdfSchema = z.object({
  stampText: z.string().trim().min(1, "Enter the text to add.").max(300),
  pageNumbers: pageSelection(),
  position: z.coerce.number().int().min(1).max(9),
  fontSize: z.coerce.number().int().min(8).max(96),
  opacity: z.coerce.number().min(0.05).max(1),
  rotation: z.coerce.number().int().min(-180).max(180),
  customColor: hexColor,
});

const pdfFormsSchema = z
  .object({
    mode: z.enum(["fill", "export-csv", "export-xlsx"]),
    data: z.string().trim().max(50_000),
    flatten: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.mode !== "fill") return;

    if (!isJsonObject(values.data)) {
      ctx.addIssue({
        code: "custom",
        path: ["data"],
        message: 'Enter form values as a JSON object, for example {"name":"Asha"}.',
      });
    }
  });

const signPdfSchema = z
  .object({
    signatureType: z.enum(["typed", "certificate"]),
    stampText: z.string().trim().max(300),
    pageNumbers: z.string().trim().max(500),
    position: z.coerce.number().int().min(1).max(9),
    fontSize: z.coerce.number().int().min(8).max(96),
    name: z.string().trim().max(100),
    reason: z.string().trim().max(200),
    location: z.string().trim().max(200),
    showSignature: z.boolean(),
    showLogo: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.signatureType !== "typed") return;

    if (!values.stampText) {
      ctx.addIssue({
        code: "custom",
        path: ["stampText"],
        message: "Enter the signature text.",
      });
    }

    const parsed = pageSelection().safeParse(values.pageNumbers);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["pageNumbers"],
        message: parsed.error.issues[0]?.message ?? "Enter the pages to sign.",
      });
    }
  });

const comparePdfSchema = z.object({
  showUnchanged: z.boolean(),
});

const webToPdfSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Enter a web address.")
    .max(2_048)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a full link starting with http:// or https://."),
  zoom: z.coerce.number().min(0.5).max(3),
});

const workflowsSchema = z.object({
  pipelineConfig: z
    .string()
    .trim()
    .min(1, "Enter a workflow configuration.")
    .max(20_000)
    .refine((value) => parsePipelineConfig(value) !== null, "Enter a valid workflow JSON object."),
});

const scanPdfSchema = jpgToPdfSchema;

const STAMP_POSITION_OPTIONS = [
  { value: "1", label: "Top left" },
  { value: "2", label: "Top centre" },
  { value: "3", label: "Top right" },
  { value: "4", label: "Middle left" },
  { value: "5", label: "Middle centre" },
  { value: "6", label: "Middle right" },
  { value: "7", label: "Bottom left" },
  { value: "8", label: "Bottom centre" },
  { value: "9", label: "Bottom right" },
] as const;

const DEFAULT_WORKFLOW = `{
  "name": "Prepare for email",
  "pipeline": [
    { "operation": "/api/v1/misc/repair", "parameters": {} },
    { "operation": "/api/v1/misc/compress-pdf", "parameters": { "optimizeLevel": 5 } }
  ]
}`;

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
  "remove-pages": {
    fields: [
      {
        kind: "text",
        name: "pageNumbers",
        label: "Pages to remove",
        placeholder: "2,5-9",
        hint: "List the pages to delete. The rest of the document is kept as-is.",
      },
    ],
    defaults: { pageNumbers: "" },
    schema: removePagesSchema,
  },
  "extract-pages": {
    fields: [
      {
        kind: "text",
        name: "pageNumbers",
        label: "Pages to keep",
        placeholder: "1,3,5-9",
        hint: "A new PDF is created with only these pages, in the order listed.",
      },
    ],
    defaults: { pageNumbers: "1" },
    schema: extractPagesSchema,
  },
  "organize-pdf": {
    fields: [
      {
        kind: "select",
        name: "customMode",
        label: "Arrangement",
        options: [
          { value: "CUSTOM", label: "Custom page order" },
          { value: "REVERSE_ORDER", label: "Reverse all pages" },
          { value: "DUPLEX_SORT", label: "Duplex sort" },
          { value: "BOOKLET_SORT", label: "Booklet sort" },
          { value: "SIDE_STITCH_BOOKLET_SORT", label: "Side-stitch booklet" },
          { value: "ODD_EVEN_SPLIT", label: "Odd pages then even pages" },
          { value: "REMOVE_FIRST", label: "Remove first page" },
          { value: "REMOVE_LAST", label: "Remove last page" },
          { value: "REMOVE_FIRST_AND_LAST", label: "Remove first and last page" },
          { value: "DUPLICATE", label: "Duplicate every page" },
        ],
      },
      {
        kind: "text",
        name: "pageNumbers",
        label: "Pages / copies",
        placeholder: "3,1,2 or 2",
        hint: "For a custom order, list pages exactly as they should appear (repeats allowed). For duplicate mode, enter 1–10 copies.",
        showWhen: { field: "customMode", equals: ["CUSTOM", "DUPLICATE"] },
      },
    ],
    defaults: { customMode: "CUSTOM", pageNumbers: "1" },
    schema: organizeSchema,
  },
  "pdf-to-word": {
    fields: [
      {
        kind: "select",
        name: "outputFormat",
        label: "Word format",
        options: [
          { value: "docx", label: "DOCX — modern Word" },
          { value: "doc", label: "DOC — legacy Word" },
          { value: "odt", label: "ODT — OpenDocument" },
        ],
      },
      {
        kind: "switch",
        name: "ocrBeforeConversion",
        label: "Recognize scanned text (OCR)",
        hint: "Adds a searchable text layer before converting scanned pages to Word.",
      },
      {
        kind: "select",
        name: "languages",
        label: "Document language",
        options: [
          { value: "eng", label: "English" },
          { value: "deu", label: "German" },
          { value: "fra", label: "French" },
          { value: "por", label: "Portuguese" },
          { value: "chi_sim", label: "Chinese (simplified)" },
        ],
        showWhen: { field: "ocrBeforeConversion", equals: [true] },
      },
    ],
    defaults: { outputFormat: "docx", ocrBeforeConversion: true, languages: "eng" },
    schema: pdfToWordSchema,
  },
  "pdf-to-powerpoint": {
    fields: [
      {
        kind: "select",
        name: "outputFormat",
        label: "Presentation format",
        options: [
          { value: "pptx", label: "PPTX — modern PowerPoint" },
          { value: "ppt", label: "PPT — legacy PowerPoint" },
          { value: "odp", label: "ODP — OpenDocument" },
        ],
      },
    ],
    defaults: { outputFormat: "pptx" },
    schema: pdfToPresentationSchema,
  },
  "pdf-to-excel": {
    fields: [],
    defaults: {},
    schema: z.object({}),
  },
  "word-to-pdf": {
    fields: [],
    defaults: {},
    schema: z.object({}),
  },
  "powerpoint-to-pdf": {
    fields: [],
    defaults: {},
    schema: z.object({}),
  },
  "excel-to-pdf": {
    fields: [],
    defaults: {},
    schema: z.object({}),
  },
  "html-to-pdf": {
    fields: [
      {
        kind: "slider",
        name: "zoom",
        label: "Page zoom",
        hint: "Scale the rendered page. 1× matches the browser default.",
        min: 0.5,
        max: 3,
        step: 0.1,
        unit: "×",
      },
    ],
    defaults: { zoom: 1 },
    schema: htmlToPdfSchema,
  },
  "pdf-to-pdfa": {
    fields: [
      {
        kind: "select",
        name: "outputFormat",
        label: "Archival profile",
        options: [
          { value: "pdfa-2b", label: "PDF/A-2b — recommended" },
          { value: "pdfa-1", label: "PDF/A-1b — strictest compatibility" },
          { value: "pdfa-3b", label: "PDF/A-3b — allows attachments" },
          { value: "pdfx", label: "PDF/X — print exchange" },
        ],
      },
      {
        kind: "switch",
        name: "strict",
        label: "Strict conversion",
        hint: "Fail instead of falling back when the document cannot be fully converted.",
      },
    ],
    defaults: { outputFormat: "pdfa-2b", strict: false },
    schema: pdfToPdfaSchema,
  },
  "watermark-pdf": {
    fields: [
      {
        kind: "text",
        name: "watermarkText",
        label: "Watermark text",
        placeholder: "CONFIDENTIAL",
      },
      {
        kind: "slider",
        name: "fontSize",
        label: "Font size",
        min: 8,
        max: 144,
        step: 1,
        unit: " pt",
      },
      {
        kind: "slider",
        name: "rotation",
        label: "Rotation",
        min: -180,
        max: 180,
        step: 5,
        unit: "°",
      },
      {
        kind: "slider",
        name: "opacity",
        label: "Opacity",
        hint: "Lower values keep the underlying content readable.",
        min: 0.05,
        max: 1,
        step: 0.05,
      },
      {
        kind: "text",
        name: "customColor",
        label: "Colour",
        placeholder: "#d3d3d3",
        hint: "Hex colour, for example #d3d3d3.",
      },
    ],
    defaults: {
      watermarkText: "CONFIDENTIAL",
      fontSize: 36,
      rotation: 45,
      opacity: 0.25,
      customColor: "#d3d3d3",
    },
    schema: watermarkSchema,
  },
  "page-numbers": {
    fields: [
      {
        kind: "text",
        name: "pageNumbers",
        label: "Pages to number",
        placeholder: "all, or 2-10",
        hint: "Leave as 'all' to number every page.",
      },
      {
        kind: "select",
        name: "fontType",
        label: "Font",
        options: [
          { value: "helvetica", label: "Helvetica" },
          { value: "courier", label: "Courier" },
          { value: "times", label: "Times" },
        ],
      },
      {
        kind: "select",
        name: "position",
        label: "Position",
        options: [
          { value: "1", label: "Top left" },
          { value: "2", label: "Top centre" },
          { value: "3", label: "Top right" },
          { value: "4", label: "Middle left" },
          { value: "5", label: "Middle centre" },
          { value: "6", label: "Middle right" },
          { value: "7", label: "Bottom left" },
          { value: "8", label: "Bottom centre" },
          { value: "9", label: "Bottom right" },
        ],
      },
      {
        kind: "text",
        name: "customText",
        label: "Number format",
        placeholder: "{n}",
        hint: "{n} is replaced with the page number, for example 'Page {n}'.",
      },
      {
        kind: "text",
        name: "startingNumber",
        label: "Start at",
        placeholder: "1",
      },
      {
        kind: "select",
        name: "fontSize",
        label: "Font size",
        options: [
          { value: "8", label: "8 pt" },
          { value: "10", label: "10 pt" },
          { value: "12", label: "12 pt" },
          { value: "14", label: "14 pt" },
          { value: "16", label: "16 pt" },
          { value: "20", label: "20 pt" },
          { value: "24", label: "24 pt" },
        ],
      },
      {
        kind: "text",
        name: "fontColor",
        label: "Colour",
        placeholder: "#000000",
        hint: "Hex colour, for example #000000.",
      },
    ],
    defaults: {
      pageNumbers: "all",
      fontType: "helvetica",
      position: 8,
      customText: "{n}",
      startingNumber: 1,
      fontSize: 12,
      fontColor: "#000000",
    },
    schema: pageNumberSchema,
  },
  "crop-pdf": {
    fields: [
      {
        kind: "switch",
        name: "autoCrop",
        label: "Auto-crop margins",
        hint: "Detect blank borders and trim them automatically.",
      },
      {
        kind: "text",
        name: "pageNumbers",
        label: "Pages to crop",
        placeholder: "all, or 1,3-5",
      },
      {
        kind: "text",
        name: "x",
        label: "Left (x)",
        placeholder: "0",
        hint: "Measured in points from the left edge (72 points = 1 inch).",
        showWhen: { field: "autoCrop", equals: [false] },
      },
      {
        kind: "text",
        name: "y",
        label: "Top (y)",
        placeholder: "0",
        hint: "Measured in points from the top edge.",
        showWhen: { field: "autoCrop", equals: [false] },
      },
      {
        kind: "text",
        name: "width",
        label: "Width",
        placeholder: "595",
        hint: "Crop width in points.",
        showWhen: { field: "autoCrop", equals: [false] },
      },
      {
        kind: "text",
        name: "height",
        label: "Height",
        placeholder: "842",
        hint: "Crop height in points.",
        showWhen: { field: "autoCrop", equals: [false] },
      },
    ],
    defaults: {
      autoCrop: true,
      pageNumbers: "all",
      x: 0,
      y: 0,
      width: 595,
      height: 842,
    },
    schema: cropSchema,
  },
  "unlock-pdf": {
    fields: [
      {
        kind: "password",
        name: "password",
        label: "Current password",
        hint: "Leave blank if the PDF opens without a password but restricts printing or copying.",
      },
      {
        kind: "switch",
        name: "removeAll",
        label: "Remove all restrictions",
        hint: "Also clears owner-password permissions such as printing and copying.",
      },
    ],
    defaults: { password: "", removeAll: true },
    schema: removePasswordSchema,
  },
  "protect-pdf": {
    fields: [
      {
        kind: "password",
        name: "password",
        label: "Open password",
        hint: "Anyone opening the PDF must enter this password.",
      },
      {
        kind: "password",
        name: "ownerPassword",
        label: "Owner password",
        hint: "Optional. Used to change permissions later; defaults to the open password.",
      },
      {
        kind: "select",
        name: "keyLength",
        label: "Encryption",
        options: [
          { value: "256", label: "AES-256 — recommended" },
          { value: "128", label: "AES-128" },
          { value: "40", label: "RC4-40 — legacy only" },
        ],
      },
      {
        kind: "switch",
        name: "preventPrinting",
        label: "Block printing",
      },
      {
        kind: "switch",
        name: "preventModify",
        label: "Block editing",
      },
      {
        kind: "switch",
        name: "preventExtractContent",
        label: "Block copying text and images",
      },
    ],
    defaults: {
      password: "",
      ownerPassword: "",
      keyLength: "256",
      preventPrinting: false,
      preventModify: false,
      preventExtractContent: false,
    },
    schema: addPasswordSchema,
  },
  "ocr-pdf": {
    fields: [
      {
        kind: "select",
        name: "languages",
        label: "Document language",
        options: [
          { value: "eng", label: "English" },
          { value: "deu", label: "German" },
          { value: "fra", label: "French" },
          { value: "por", label: "Portuguese" },
          { value: "chi_sim", label: "Chinese (simplified)" },
        ],
      },
      {
        kind: "segmented",
        name: "ocrType",
        label: "OCR mode",
        options: [
          { value: "skip-text", label: "Skip pages with text" },
          { value: "force-ocr", label: "Re-OCR every page" },
        ],
      },
      {
        kind: "switch",
        name: "deskew",
        label: "Deskew pages",
        hint: "Straighten slightly tilted scans before recognition.",
      },
      {
        kind: "switch",
        name: "rotatePages",
        label: "Auto-rotate pages",
      },
      {
        kind: "switch",
        name: "clean",
        label: "Clean the scan",
        hint: "Remove noise and improve contrast before recognition.",
      },
    ],
    defaults: {
      languages: "eng",
      ocrType: "skip-text",
      deskew: false,
      rotatePages: false,
      clean: false,
    },
    schema: ocrSchema,
  },
  "repair-pdf": {
    fields: [],
    defaults: {},
    schema: z.object({}),
  },
  "redact-pdf": {
    fields: [
      {
        kind: "textarea",
        name: "listOfText",
        label: "Words or phrases to redact",
        rows: 4,
        placeholder: "One term per line\nOrder #12345\nname@example.com",
        hint: "Every occurrence is permanently blacked out. One term per line.",
      },
      {
        kind: "switch",
        name: "useRegex",
        label: "Treat terms as regular expressions",
        hint: "Advanced: enables patterns such as \\d{4}-\\d{4}.",
      },
      {
        kind: "switch",
        name: "wholeWordSearch",
        label: "Whole words only",
      },
      {
        kind: "switch",
        name: "caseSensitive",
        label: "Case sensitive",
      },
      {
        kind: "text",
        name: "redactColor",
        label: "Redaction colour",
        placeholder: "#000000",
        hint: "Hex colour, for example #000000.",
      },
    ],
    defaults: {
      listOfText: "",
      useRegex: false,
      wholeWordSearch: false,
      caseSensitive: false,
      redactColor: "#000000",
    },
    schema: redactSchema,
  },
  "edit-pdf": {
    fields: [
      {
        kind: "text",
        name: "stampText",
        label: "Text to add",
        placeholder: "Approved — 18 Nov 2026",
        hint: "The text is stamped onto the selected pages.",
      },
      {
        kind: "text",
        name: "pageNumbers",
        label: "Pages",
        placeholder: "all, or 1,3-5",
      },
      {
        kind: "select",
        name: "position",
        label: "Position",
        options: [...STAMP_POSITION_OPTIONS],
      },
      {
        kind: "slider",
        name: "fontSize",
        label: "Font size",
        min: 8,
        max: 96,
        step: 1,
        unit: " pt",
      },
      {
        kind: "slider",
        name: "opacity",
        label: "Opacity",
        min: 0.05,
        max: 1,
        step: 0.05,
      },
      {
        kind: "slider",
        name: "rotation",
        label: "Rotation",
        min: -180,
        max: 180,
        step: 5,
        unit: "°",
      },
      {
        kind: "text",
        name: "customColor",
        label: "Colour",
        placeholder: "#000000",
        hint: "Hex colour, for example #000000.",
      },
    ],
    defaults: {
      stampText: "",
      pageNumbers: "all",
      position: 8,
      fontSize: 24,
      opacity: 0.8,
      rotation: 0,
      customColor: "#000000",
    },
    schema: editPdfSchema,
  },
  "pdf-forms": {
    fields: [
      {
        kind: "segmented",
        name: "mode",
        label: "Action",
        options: [
          { value: "fill", label: "Fill form" },
          { value: "export-csv", label: "Export CSV" },
          { value: "export-xlsx", label: "Export Excel" },
        ],
      },
      {
        kind: "textarea",
        name: "data",
        label: "Field values (JSON)",
        rows: 7,
        placeholder: '{\n  "fullName": "Asha Sharma",\n  "date": "2026-11-18"\n}',
        hint: 'Use the exact field names from the PDF. Exporting does not need this.',
        showWhen: { field: "mode", equals: ["fill"] },
      },
      {
        kind: "switch",
        name: "flatten",
        label: "Flatten after filling",
        hint: "Makes the answers permanent so the form can no longer be edited.",
        showWhen: { field: "mode", equals: ["fill"] },
      },
    ],
    defaults: { mode: "fill", data: "{}", flatten: false },
    schema: pdfFormsSchema,
  },
  "sign-pdf": {
    fields: [
      {
        kind: "segmented",
        name: "signatureType",
        label: "Signature type",
        options: [
          { value: "typed", label: "Typed signature" },
          { value: "certificate", label: "Certificate" },
        ],
      },
      {
        kind: "text",
        name: "stampText",
        label: "Signature text",
        placeholder: "Asha Sharma",
        hint: "Shown on the page as a visual signature.",
        showWhen: { field: "signatureType", equals: ["typed"] },
      },
      {
        kind: "text",
        name: "pageNumbers",
        label: "Pages to sign",
        placeholder: "all, or 1",
        showWhen: { field: "signatureType", equals: ["typed"] },
      },
      {
        kind: "select",
        name: "position",
        label: "Position",
        options: [...STAMP_POSITION_OPTIONS],
        showWhen: { field: "signatureType", equals: ["typed"] },
      },
      {
        kind: "slider",
        name: "fontSize",
        label: "Signature size",
        min: 8,
        max: 96,
        step: 1,
        unit: " pt",
        showWhen: { field: "signatureType", equals: ["typed"] },
      },
      {
        kind: "text",
        name: "name",
        label: "Signer name",
        placeholder: "Asha Sharma",
        showWhen: { field: "signatureType", equals: ["certificate"] },
      },
      {
        kind: "text",
        name: "reason",
        label: "Reason",
        placeholder: "Approved",
        showWhen: { field: "signatureType", equals: ["certificate"] },
      },
      {
        kind: "text",
        name: "location",
        label: "Location",
        placeholder: "Kasia",
        showWhen: { field: "signatureType", equals: ["certificate"] },
      },
      {
        kind: "switch",
        name: "showSignature",
        label: "Show signature panel",
        showWhen: { field: "signatureType", equals: ["certificate"] },
      },
      {
        kind: "switch",
        name: "showLogo",
        label: "Show engine logo",
        showWhen: { field: "signatureType", equals: ["certificate"] },
      },
    ],
    defaults: {
      signatureType: "typed",
      stampText: "",
      pageNumbers: "all",
      position: 8,
      fontSize: 24,
      name: "",
      reason: "",
      location: "",
      showSignature: true,
      showLogo: true,
    },
    schema: signPdfSchema,
  },
  "compare-pdf": {
    fields: [
      {
        kind: "switch",
        name: "showUnchanged",
        label: "Include unchanged lines",
        hint: "Off shows only added and removed text.",
      },
    ],
    defaults: { showUnchanged: false },
    schema: comparePdfSchema,
  },
  "pdf-to-markdown": {
    fields: [],
    defaults: {},
    schema: z.object({}),
  },
  "web-to-pdf": {
    fields: [
      {
        kind: "text",
        name: "url",
        label: "Web address",
        placeholder: "https://example.com/article",
        hint: "Only public http and https pages can be captured.",
      },
      {
        kind: "slider",
        name: "zoom",
        label: "Page zoom",
        hint: "Scale the rendered page. 1× matches the browser default.",
        min: 0.5,
        max: 3,
        step: 0.1,
        unit: "×",
      },
    ],
    defaults: { url: "", zoom: 1 },
    schema: webToPdfSchema,
  },
  workflows: {
    fields: [
      {
        kind: "textarea",
        name: "pipelineConfig",
        label: "Workflow JSON",
        rows: 14,
        hint: "Operations run in order. Each operation uses a verified Stirling endpoint.",
      },
    ],
    defaults: { pipelineConfig: DEFAULT_WORKFLOW },
    schema: workflowsSchema,
  },
  "scan-pdf": {
    fields: [
      {
        kind: "select",
        name: "fitOption",
        label: "Page fit",
        options: [
          { value: "fillPage", label: "Fill the page" },
          { value: "fitDocumentToImage", label: "Page matches photo" },
          { value: "fitDocumentToPage", label: "Photo fits inside page" },
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
        label: "Auto-rotate pages",
        hint: "Corrects photos taken sideways.",
      },
    ],
    defaults: { fitOption: "fillPage", colorType: "color", autoRotate: true },
    schema: scanPdfSchema,
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
