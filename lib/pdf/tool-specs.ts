import { AppError } from "@/lib/errors";
import { sanitizeFilename } from "@/lib/security/validation";
import type { StirlingClient } from "@/lib/stirling/client";
import type { MergeSortType, StirlingFileResult } from "@/lib/stirling/types";
import type { ToolValues } from "./tool-options";
import type { PdfTool } from "./tools";

/**
 * Executes a tool against the Stirling client.
 * Only tools with a verified endpoint are reachable here.
 */

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function extensionFor(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType.toLowerCase()] ?? "bin";
}

function firstFile(files: readonly { filename: string }[]): void {
  if (files.length === 0) {
    throw new AppError("INVALID_INPUT", "No file supplied");
  }
}

export type ToolExecution = {
  result: StirlingFileResult;
  filename: string;
};

function withExtension(filename: string, extension: string): string {
  if (extension === "bin") return filename;
  const lower = filename.toLowerCase();
  if (lower.endsWith(`.${extension}`)) return filename;
  if (extension === "jpg" && lower.endsWith(".jpeg")) return filename;
  return `${filename.replace(/\.[^.]+$/, "")}.${extension}`;
}

export async function executeTool(
  tool: PdfTool,
  client: StirlingClient,
  files: Parameters<typeof client.mergePdfs>[0],
  values: ToolValues,
): Promise<ToolExecution> {
  let result: StirlingFileResult;
  let fallbackName: string;

  switch (tool.id) {
    case "merge-pdf": {
      result = await client.mergePdfs(files, {
        sortType: String(values.sortType ?? "orderProvided") as MergeSortType,
        generateToc: Boolean(values.generateToc),
      });
      fallbackName = "merged.pdf";
      break;
    }
    case "split-pdf": {
      firstFile(files);
      result = await client.splitPdf(files[0]!, {
        pageNumbers: String(values.pageNumbers ?? "all"),
      });
      fallbackName = "split-documents";
      break;
    }
    case "compress-pdf": {
      firstFile(files);
      result = await client.compressPdf(files[0]!, {
        optimizeLevel: Number(values.optimizeLevel ?? 5),
        grayscale: Boolean(values.grayscale),
        linearize: Boolean(values.linearize),
      });
      fallbackName = "compressed.pdf";
      break;
    }
    case "rotate-pdf": {
      firstFile(files);
      result = await client.rotatePdf(files[0]!, {
        angle: Number(values.angle ?? 90) as 0 | 90 | 180 | 270,
      });
      fallbackName = "rotated.pdf";
      break;
    }
    case "jpg-to-pdf": {
      result = await client.imagesToPdf(files, {
        fitOption: String(values.fitOption ?? "fillPage") as
          "fillPage" | "fitDocumentToImage" | "fitDocumentToPage" | "maintainAspectRatio",
        colorType: String(values.colorType ?? "color") as "color" | "greyscale" | "blackwhite",
        autoRotate: Boolean(values.autoRotate),
      });
      fallbackName = "images.pdf";
      break;
    }
    case "pdf-to-jpg": {
      firstFile(files);
      result = await client.pdfToImages(files[0]!, {
        imageFormat: String(values.imageFormat ?? "jpeg") as "jpeg" | "png" | "webp",
        dpi: Number(values.dpi ?? 300),
        singleOrMultiple: String(values.singleOrMultiple ?? "multiple") as "single" | "multiple",
        colorType: String(values.colorType ?? "color") as "color" | "greyscale" | "blackwhite",
      });
      fallbackName = values.singleOrMultiple === "single" ? "page-image" : "pages";
      break;
    }
    default: {
      throw new AppError("TOOL_NOT_AVAILABLE", "No executor registered for tool", {
        details: { toolId: tool.id },
        userMessage: "This tool is not available yet.",
      });
    }
  }

  const extension = extensionFor(result.contentType);
  const upstreamName = parseContentDispositionFilename(result.contentDisposition);
  const candidate = upstreamName ? sanitizeFilename(upstreamName) : fallbackName;

  return {
    result,
    filename: withExtension(candidate, extension),
  };
}

/** Extracts a filename from a Content-Disposition header without trusting other parts. */
export function parseContentDispositionFilename(header: string | undefined): string | undefined {
  if (!header) return undefined;

  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return undefined;
    }
  }

  const plainMatch = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  return plainMatch?.[1]?.trim();
}
