import type { FileKind } from "@/lib/files/file-kind";

/**
 * Central tool registry.
 *
 * Every tool shown in the navigation comes from this file. A tool becomes
 * usable only when it has `status: "available"` and a verified Stirling
 * endpoint. UI pages and navigation are generated from this data; the API
 * handler rejects anything that is not available.
 */

export type PdfCategoryId =
  "organize" | "optimize" | "convert" | "edit" | "security" | "intelligence" | "other";

export type ToolStatus = "available" | "planned";

export type ToolOutputKind = "pdf" | "images" | "archive" | "office" | "text" | "other";

export type PdfCategory = {
  id: PdfCategoryId;
  label: string;
  description: string;
  icon: string;
  order: number;
};

export type ToolInputSpec = {
  kinds: readonly FileKind[];
  multiple: boolean;
  minFiles: number;
  maxFiles: number;
  ordered: boolean;
  accept: string;
};

export type ToolOutputSpec = {
  kind: ToolOutputKind;
  label: string;
};

export type PdfTool = {
  id: string;
  slug: string;
  name: string;
  /** One line used on cards. */
  summary: string;
  /** Longer copy for the tool page. */
  description: string;
  category: PdfCategoryId;
  icon: string;
  phase: 1 | 2 | 3;
  status: ToolStatus;
  endpoint?: string;
  input: ToolInputSpec;
  output: ToolOutputSpec;
};

const PDF_ONLY = ".pdf,application/pdf";
const IMAGES = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export const CATEGORIES = [
  {
    id: "organize",
    label: "Organize",
    description: "Merge, split and rearrange pages.",
    icon: "layout",
    order: 1,
  },
  {
    id: "optimize",
    label: "Optimize",
    description: "Shrink files without losing quality.",
    icon: "minimize",
    order: 2,
  },
  {
    id: "convert",
    label: "Convert",
    description: "Move between PDF, Office and images.",
    icon: "repeat",
    order: 3,
  },
  {
    id: "edit",
    label: "Edit",
    description: "Rotate, watermark, number and annotate.",
    icon: "pen",
    order: 4,
  },
  {
    id: "security",
    label: "Security",
    description: "Protect, sign, unlock and redact.",
    icon: "shield",
    order: 5,
  },
  {
    id: "intelligence",
    label: "Intelligence",
    description: "OCR, repair, compare and understand.",
    icon: "sparkles",
    order: 6,
  },
  {
    id: "other",
    label: "Other",
    description: "Capture, scan and automate.",
    icon: "layers",
    order: 7,
  },
] as const satisfies readonly PdfCategory[];

export const TOOLS = [
  // ---------------------------------------------------------------- Organize
  {
    id: "merge-pdf",
    slug: "merge-pdf",
    name: "Merge PDF",
    summary: "Combine several PDFs into a single document.",
    description:
      "Upload two or more PDFs, arrange them in the exact order you need, and download one combined document. Page order is preserved exactly as shown.",
    category: "organize",
    icon: "merge",
    phase: 1,
    status: "available",
    endpoint: "/api/v1/general/merge-pdfs",
    input: {
      kinds: ["pdf"],
      multiple: true,
      minFiles: 2,
      maxFiles: 10,
      ordered: true,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Merged PDF" },
  },
  {
    id: "split-pdf",
    slug: "split-pdf",
    name: "Split PDF",
    summary: "Split at selected pages or export every page.",
    description:
      "Choose split points and Stirling cuts the document after each one. Use `all` to produce one file per page; multiple results arrive as a ZIP archive.",
    category: "organize",
    icon: "split",
    phase: 1,
    status: "available",
    endpoint: "/api/v1/general/split-pages",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "archive", label: "PDF files (ZIP when multiple)" },
  },
  {
    id: "remove-pages",
    slug: "remove-pages",
    name: "Remove Pages",
    summary: "Delete the pages you do not need.",
    description: "Select pages to remove and keep the rest of the document untouched.",
    category: "organize",
    icon: "remove-page",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "PDF without selected pages" },
  },
  {
    id: "extract-pages",
    slug: "extract-pages",
    name: "Extract Pages",
    summary: "Pull selected pages into a new PDF.",
    description: "Create a new document containing only the pages you choose.",
    category: "organize",
    icon: "extract-page",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Extracted pages" },
  },
  {
    id: "organize-pdf",
    slug: "organize-pdf",
    name: "Organize PDF",
    summary: "Reorder, rotate and remove pages visually.",
    description: "A visual page workspace for rearranging a document before saving.",
    category: "organize",
    icon: "organize",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Organized PDF" },
  },

  // ---------------------------------------------------------------- Optimize
  {
    id: "compress-pdf",
    slug: "compress-pdf",
    name: "Compress PDF",
    summary: "Reduce file size with adjustable strength.",
    description:
      "Recompress images and clean up document structure. Choose a lighter setting for print-quality documents or a stronger one for email attachments.",
    category: "optimize",
    icon: "compress",
    phase: 1,
    status: "available",
    endpoint: "/api/v1/misc/compress-pdf",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Compressed PDF" },
  },

  // ----------------------------------------------------------------- Convert
  {
    id: "pdf-to-word",
    slug: "pdf-to-word",
    name: "PDF to Word",
    summary: "Turn a PDF into an editable Word file.",
    description: "Convert text and layout into a DOCX document you can edit.",
    category: "convert",
    icon: "pdf-to-word",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "office", label: "Word document" },
  },
  {
    id: "pdf-to-powerpoint",
    slug: "pdf-to-powerpoint",
    name: "PDF to PowerPoint",
    summary: "Convert pages into editable slides.",
    description: "Create a PPTX presentation from a PDF.",
    category: "convert",
    icon: "pdf-to-powerpoint",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "office", label: "PowerPoint presentation" },
  },
  {
    id: "pdf-to-excel",
    slug: "pdf-to-excel",
    name: "PDF to Excel",
    summary: "Extract tables into a spreadsheet.",
    description: "Convert tabular PDF content into an XLSX workbook.",
    category: "convert",
    icon: "pdf-to-excel",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "office", label: "Excel workbook" },
  },
  {
    id: "word-to-pdf",
    slug: "word-to-pdf",
    name: "Word to PDF",
    summary: "Convert DOCX documents to PDF.",
    description: "Produce a fixed-layout PDF from a Word document.",
    category: "convert",
    icon: "word-to-pdf",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["zip"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: ".doc,.docx",
    },
    output: { kind: "pdf", label: "PDF" },
  },
  {
    id: "powerpoint-to-pdf",
    slug: "powerpoint-to-pdf",
    name: "PowerPoint to PDF",
    summary: "Convert presentations to PDF.",
    description: "Turn PPTX slides into a shareable PDF.",
    category: "convert",
    icon: "powerpoint-to-pdf",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["zip"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: ".ppt,.pptx",
    },
    output: { kind: "pdf", label: "PDF" },
  },
  {
    id: "excel-to-pdf",
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    summary: "Convert spreadsheets to PDF.",
    description: "Render an XLSX workbook as a PDF document.",
    category: "convert",
    icon: "excel-to-pdf",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["zip"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: ".xls,.xlsx",
    },
    output: { kind: "pdf", label: "PDF" },
  },
  {
    id: "pdf-to-jpg",
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    summary: "Export pages as high-quality images.",
    description:
      "Render each page as an image at your chosen resolution. Multiple pages are returned as a ZIP archive.",
    category: "convert",
    icon: "pdf-to-jpg",
    phase: 1,
    status: "available",
    endpoint: "/api/v1/convert/pdf/img",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "images", label: "Images (ZIP when multiple)" },
  },
  {
    id: "jpg-to-pdf",
    slug: "jpg-to-pdf",
    name: "JPG to PDF",
    summary: "Combine images into a single PDF.",
    description:
      "Place JPG, PNG or WebP images onto PDF pages. Arrange the order and choose how each image fits the page.",
    category: "convert",
    icon: "jpg-to-pdf",
    phase: 1,
    status: "available",
    endpoint: "/api/v1/convert/img/pdf",
    input: {
      kinds: ["jpeg", "png", "webp"],
      multiple: true,
      minFiles: 1,
      maxFiles: 10,
      ordered: true,
      accept: IMAGES,
    },
    output: { kind: "pdf", label: "PDF from images" },
  },
  {
    id: "html-to-pdf",
    slug: "html-to-pdf",
    name: "HTML to PDF",
    summary: "Render an HTML file as a PDF.",
    description: "Convert an uploaded HTML document into a PDF.",
    category: "convert",
    icon: "html-to-pdf",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["zip"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: ".html,.htm,.zip",
    },
    output: { kind: "pdf", label: "PDF" },
  },
  {
    id: "pdf-to-pdfa",
    slug: "pdf-to-pdfa",
    name: "PDF to PDF/A",
    summary: "Create an archival-grade PDF.",
    description: "Convert to PDF/A for long-term archiving and compliance.",
    category: "convert",
    icon: "pdf-to-pdfa",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "PDF/A document" },
  },

  // -------------------------------------------------------------------- Edit
  {
    id: "edit-pdf",
    slug: "edit-pdf",
    name: "Edit PDF",
    summary: "Add text, shapes and annotations.",
    description: "A browser workspace for enriching documents before export.",
    category: "edit",
    icon: "edit",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Edited PDF" },
  },
  {
    id: "rotate-pdf",
    slug: "rotate-pdf",
    name: "Rotate PDF",
    summary: "Fix page orientation in one click.",
    description: "Rotate every page 90, 180 or 270 degrees clockwise.",
    category: "edit",
    icon: "rotate",
    phase: 1,
    status: "available",
    endpoint: "/api/v1/general/rotate-pdf",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Rotated PDF" },
  },
  {
    id: "watermark-pdf",
    slug: "watermark-pdf",
    name: "Watermark PDF",
    summary: "Stamp text or an image across pages.",
    description: "Apply a configurable text or image watermark.",
    category: "edit",
    icon: "watermark",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Watermarked PDF" },
  },
  {
    id: "page-numbers",
    slug: "page-numbers",
    name: "Page Numbers",
    summary: "Add numbering to a document.",
    description: "Insert page numbers with configurable position and format.",
    category: "edit",
    icon: "page-numbers",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Numbered PDF" },
  },
  {
    id: "crop-pdf",
    slug: "crop-pdf",
    name: "Crop PDF",
    summary: "Trim margins and page borders.",
    description: "Crop pages to a selected area or uniform margins.",
    category: "edit",
    icon: "crop",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Cropped PDF" },
  },
  {
    id: "pdf-forms",
    slug: "pdf-forms",
    name: "PDF Forms",
    summary: "Fill and flatten interactive forms.",
    description: "Complete form fields and optionally flatten the result.",
    category: "edit",
    icon: "forms",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Completed form" },
  },

  // ---------------------------------------------------------------- Security
  {
    id: "unlock-pdf",
    slug: "unlock-pdf",
    name: "Unlock PDF",
    summary: "Remove a known password from a PDF.",
    description: "Decrypt a document when you know its current password.",
    category: "security",
    icon: "unlock",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Unlocked PDF" },
  },
  {
    id: "protect-pdf",
    slug: "protect-pdf",
    name: "Protect PDF",
    summary: "Add password protection and permissions.",
    description: "Encrypt a PDF and restrict printing, copying or editing.",
    category: "security",
    icon: "protect",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Protected PDF" },
  },
  {
    id: "sign-pdf",
    slug: "sign-pdf",
    name: "Sign PDF",
    summary: "Apply a visual or certificate signature.",
    description: "Add a signature image or a digital certificate signature.",
    category: "security",
    icon: "sign",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Signed PDF" },
  },
  {
    id: "redact-pdf",
    slug: "redact-pdf",
    name: "Redact PDF",
    summary: "Permanently remove sensitive content.",
    description: "Black out and permanently delete selected text or areas.",
    category: "security",
    icon: "redact",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Redacted PDF" },
  },

  // ------------------------------------------------------------ Intelligence
  {
    id: "ocr-pdf",
    slug: "ocr-pdf",
    name: "OCR PDF",
    summary: "Make scanned documents searchable.",
    description: "Add a text layer to scans using optical character recognition.",
    category: "intelligence",
    icon: "ocr",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Searchable PDF" },
  },
  {
    id: "repair-pdf",
    slug: "repair-pdf",
    name: "Repair PDF",
    summary: "Recover a damaged or malformed PDF.",
    description: "Attempt to rebuild the document structure so it opens again.",
    category: "intelligence",
    icon: "repair",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Repaired PDF" },
  },
  {
    id: "compare-pdf",
    slug: "compare-pdf",
    name: "Compare PDF",
    summary: "Highlight differences between two PDFs.",
    description: "Compare two documents and review changes side by side.",
    category: "intelligence",
    icon: "compare",
    phase: 2,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: true,
      minFiles: 2,
      maxFiles: 2,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Comparison report" },
  },
  {
    id: "ai-summarize",
    slug: "ai-summarize",
    name: "AI Summarize PDF",
    summary: "Generate a summary of a document.",
    description:
      "Phase 3 only. Requires an explicitly configured AI provider and a privacy review before any document leaves the company network.",
    category: "intelligence",
    icon: "summarize",
    phase: 3,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "text", label: "Summary" },
  },
  {
    id: "translate-pdf",
    slug: "translate-pdf",
    name: "Translate PDF",
    summary: "Translate a document into another language.",
    description: "Phase 3 only. Requires an explicitly configured translation provider.",
    category: "intelligence",
    icon: "translate",
    phase: 3,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "pdf", label: "Translated PDF" },
  },
  {
    id: "pdf-to-markdown",
    slug: "pdf-to-markdown",
    name: "PDF to Markdown",
    summary: "Convert a PDF into clean Markdown.",
    description: "Extract structure and text into a Markdown file.",
    category: "intelligence",
    icon: "markdown",
    phase: 3,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "text", label: "Markdown file" },
  },

  // ------------------------------------------------------------------- Other
  {
    id: "web-to-pdf",
    slug: "web-to-pdf",
    name: "Web to PDF",
    summary: "Capture a web page as a PDF.",
    description:
      "URL capture requires SSRF protection and an explicit allowlist. Planned for Phase 3.",
    category: "other",
    icon: "web",
    phase: 3,
    status: "planned",
    input: { kinds: [], multiple: false, minFiles: 0, maxFiles: 0, ordered: false, accept: "" },
    output: { kind: "pdf", label: "Web page PDF" },
  },
  {
    id: "scan-pdf",
    slug: "scan-pdf",
    name: "Scan PDF",
    summary: "Capture pages with a camera or scanner.",
    description: "Mobile capture flow with automatic edge detection.",
    category: "other",
    icon: "scan",
    phase: 3,
    status: "planned",
    input: {
      kinds: ["jpeg", "png"],
      multiple: true,
      minFiles: 1,
      maxFiles: 10,
      ordered: true,
      accept: IMAGES,
    },
    output: { kind: "pdf", label: "Scanned PDF" },
  },
  {
    id: "workflows",
    slug: "workflows",
    name: "Workflows",
    summary: "Chain several tools into one pipeline.",
    description: "Build repeatable processing pipelines with Stirling's pipeline API.",
    category: "other",
    icon: "workflows",
    phase: 3,
    status: "planned",
    input: {
      kinds: ["pdf"],
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      ordered: false,
      accept: PDF_ONLY,
    },
    output: { kind: "other", label: "Pipeline output" },
  },
] as const satisfies readonly PdfTool[];

export type ToolId = (typeof TOOLS)[number]["id"];

export const TOOL_IDS = TOOLS.map((tool) => tool.id) as ToolId[];

export function isToolId(value: string): value is ToolId {
  return TOOLS.some((tool) => tool.id === value);
}

export function getToolById(id: string): PdfTool | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export function getToolBySlug(slug: string): PdfTool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function getToolsByCategory(category: PdfCategoryId): PdfTool[] {
  return TOOLS.filter((tool) => tool.category === category);
}

export function getAvailableTools(): PdfTool[] {
  return TOOLS.filter((tool) => tool.status === "available");
}

export function getPlannedTools(): PdfTool[] {
  return TOOLS.filter((tool) => tool.status === "planned");
}

export function getCategory(id: PdfCategoryId): PdfCategory | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

/** Categories in display order, including their tools in registry order. */
export function getNavigationGroups(): Array<PdfCategory & { tools: PdfTool[] }> {
  return [...CATEGORIES]
    .sort((left, right) => left.order - right.order)
    .map((category) => ({
      ...category,
      tools: getToolsByCategory(category.id),
    }))
    .filter((group) => group.tools.length > 0);
}

export function getRelatedTools(tool: PdfTool, limit = 3): PdfTool[] {
  return TOOLS.filter(
    (candidate) =>
      candidate.category === tool.category &&
      candidate.id !== tool.id &&
      candidate.status === "available",
  ).slice(0, limit);
}
