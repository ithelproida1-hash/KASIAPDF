import { getServerConfig } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { sanitizeFilename } from "@/lib/security/validation";
import type { StirlingClient } from "@/lib/stirling/client";
import type {
  MergeSortType,
  RearrangePagesMode,
  StirlingFileResult,
} from "@/lib/stirling/types";
import { buildComparisonHtml } from "./compare";
import { parsePipelineConfig, type ToolValues } from "./tool-options";
import type { PdfTool } from "./tools";
import { captureWebPage } from "./web-capture";

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
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "text/csv": "csv",
  "text/plain": "txt",
  "text/markdown": "md",
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
    case "remove-pages": {
      firstFile(files);
      result = await client.removePages(files[0]!, {
        pageNumbers: String(values.pageNumbers ?? ""),
      });
      fallbackName = "pages-removed.pdf";
      break;
    }
    case "extract-pages": {
      firstFile(files);
      result = await client.rearrangePages(files[0]!, {
        customMode: "CUSTOM",
        pageNumbers: String(values.pageNumbers ?? ""),
      });
      fallbackName = "extracted-pages.pdf";
      break;
    }
    case "organize-pdf": {
      firstFile(files);
      result = await client.rearrangePages(files[0]!, {
        customMode: String(values.customMode ?? "CUSTOM") as RearrangePagesMode,
        pageNumbers: String(values.pageNumbers ?? ""),
      });
      fallbackName = "organized.pdf";
      break;
    }
    case "pdf-to-word": {
      firstFile(files);
      const outputFormat = String(values.outputFormat ?? "docx") as "doc" | "docx" | "odt";
      let sourceFile = files[0]!;

      if (values.ocrBeforeConversion) {
        const ocrResult = await client.ocrPdf(sourceFile, {
          languages: String(values.languages ?? "eng"),
          ocrType: "skip-text",
        });

        if (ocrResult.bytes.byteLength === 0) {
          throw new AppError("PROCESSING_FAILED", "Stirling returned an empty OCR document", {
            retryable: true,
          });
        }

        sourceFile = {
          filename: sourceFile.filename,
          contentType: "application/pdf",
          bytes: ocrResult.bytes,
        };
      }

      result = await client.pdfToWord(sourceFile, { outputFormat });
      fallbackName = `document.${outputFormat}`;
      break;
    }
    case "pdf-to-powerpoint": {
      firstFile(files);
      const outputFormat = String(values.outputFormat ?? "pptx") as "ppt" | "pptx" | "odp";
      result = await client.pdfToPresentation(files[0]!, { outputFormat });
      fallbackName = `presentation.${outputFormat}`;
      break;
    }
    case "pdf-to-excel": {
      firstFile(files);
      result = await client.pdfToExcel(files[0]!);
      fallbackName = "spreadsheet.xlsx";
      break;
    }
    case "word-to-pdf":
    case "powerpoint-to-pdf":
    case "excel-to-pdf": {
      firstFile(files);
      result = await client.fileToPdf(files[0]!);
      fallbackName = "converted.pdf";
      break;
    }
    case "html-to-pdf": {
      firstFile(files);
      result = await client.htmlToPdf(files[0]!, { zoom: Number(values.zoom ?? 1) });
      fallbackName = "rendered.pdf";
      break;
    }
    case "pdf-to-pdfa": {
      firstFile(files);
      result = await client.pdfToPdfA(files[0]!, {
        outputFormat: String(values.outputFormat ?? "pdfa-2b") as
          | "pdfa"
          | "pdfa-1"
          | "pdfa-2"
          | "pdfa-2b"
          | "pdfa-3"
          | "pdfa-3b"
          | "pdfx",
        strict: Boolean(values.strict),
      });
      fallbackName = "archival.pdf";
      break;
    }
    case "watermark-pdf": {
      firstFile(files);
      result = await client.addWatermark(files[0]!, {
        watermarkText: String(values.watermarkText ?? ""),
        fontSize: Number(values.fontSize ?? 36),
        rotation: Number(values.rotation ?? 45),
        opacity: Number(values.opacity ?? 0.25),
        customColor: String(values.customColor ?? "#d3d3d3"),
      });
      fallbackName = "watermarked.pdf";
      break;
    }
    case "page-numbers": {
      firstFile(files);
      result = await client.addPageNumbers(files[0]!, {
        pageNumbers: String(values.pageNumbers ?? "all"),
        fontType: String(values.fontType ?? "helvetica") as "helvetica" | "courier" | "times",
        position: Number(values.position ?? 8),
        customText: String(values.customText ?? "{n}"),
        startingNumber: Number(values.startingNumber ?? 1),
        fontSize: Number(values.fontSize ?? 12),
        fontColor: String(values.fontColor ?? "#000000"),
      });
      fallbackName = "numbered.pdf";
      break;
    }
    case "crop-pdf": {
      firstFile(files);
      result = await client.cropPdf(files[0]!, {
        autoCrop: Boolean(values.autoCrop),
        pageNumbers: String(values.pageNumbers ?? "all"),
        x: Number(values.x ?? 0),
        y: Number(values.y ?? 0),
        width: Number(values.width ?? 0),
        height: Number(values.height ?? 0),
      });
      fallbackName = "cropped.pdf";
      break;
    }
    case "unlock-pdf": {
      firstFile(files);
      result = await client.removePassword(files[0]!, {
        password: String(values.password ?? ""),
        removeAll: Boolean(values.removeAll),
      });
      fallbackName = "unlocked.pdf";
      break;
    }
    case "protect-pdf": {
      firstFile(files);
      result = await client.addPassword(files[0]!, {
        password: String(values.password ?? ""),
        ownerPassword: String(values.ownerPassword ?? "") || undefined,
        keyLength: Number(values.keyLength ?? 256) as 40 | 128 | 256,
        preventPrinting: Boolean(values.preventPrinting),
        preventModify: Boolean(values.preventModify),
        preventExtractContent: Boolean(values.preventExtractContent),
      });
      fallbackName = "protected.pdf";
      break;
    }
    case "ocr-pdf": {
      firstFile(files);
      result = await client.ocrPdf(files[0]!, {
        languages: String(values.languages ?? "eng"),
        ocrType: String(values.ocrType ?? "skip-text") as "skip-text" | "force-ocr" | "Normal",
        deskew: Boolean(values.deskew),
        rotatePages: Boolean(values.rotatePages),
        clean: Boolean(values.clean),
      });
      fallbackName = "searchable.pdf";
      break;
    }
    case "repair-pdf": {
      firstFile(files);
      result = await client.repairPdf(files[0]!);
      fallbackName = "repaired.pdf";
      break;
    }
    case "redact-pdf": {
      firstFile(files);
      result = await client.autoRedact(files[0]!, {
        listOfText: String(values.listOfText ?? ""),
        useRegex: Boolean(values.useRegex),
        wholeWordSearch: Boolean(values.wholeWordSearch),
        caseSensitive: Boolean(values.caseSensitive),
        redactColor: String(values.redactColor ?? "#000000"),
      });
      fallbackName = "redacted.pdf";
      break;
    }
    case "edit-pdf": {
      firstFile(files);
      result = await client.addStamp(files[0]!, {
        stampType: "text",
        stampText: String(values.stampText ?? ""),
        pageNumbers: String(values.pageNumbers ?? "all"),
        position: Number(values.position ?? 8),
        fontSize: Number(values.fontSize ?? 24),
        opacity: Number(values.opacity ?? 0.8),
        rotation: Number(values.rotation ?? 0),
        customColor: String(values.customColor ?? "#000000"),
      });
      fallbackName = "edited.pdf";
      break;
    }
    case "pdf-forms": {
      firstFile(files);
      const mode = String(values.mode ?? "fill");
      const data = String(values.data ?? "{}").trim() || "{}";

      if (mode === "export-csv") {
        result = await client.extractFormCsv(files[0]!);
        fallbackName = "form-fields";
      } else if (mode === "export-xlsx") {
        result = await client.extractFormXlsx(files[0]!);
        fallbackName = "form-fields";
      } else {
        result = await client.fillForm(files[0]!, {
          data,
          flatten: Boolean(values.flatten),
        });
        fallbackName = "filled-form.pdf";
      }
      break;
    }
    case "sign-pdf": {
      firstFile(files);
      const signatureType = String(values.signatureType ?? "typed");

      if (signatureType === "certificate") {
        result = await client.certSign(files[0]!, {
          certType: "SERVER",
          showSignature: Boolean(values.showSignature),
          showLogo: Boolean(values.showLogo),
          name: String(values.name ?? "") || undefined,
          reason: String(values.reason ?? "") || undefined,
          location: String(values.location ?? "") || undefined,
          pageNumber: 1,
        });
      } else {
        result = await client.addStamp(files[0]!, {
          stampType: "text",
          stampText: String(values.stampText ?? ""),
          pageNumbers: String(values.pageNumbers ?? "all"),
          position: Number(values.position ?? 8),
          fontSize: Number(values.fontSize ?? 24),
          opacity: 1,
          rotation: 0,
          customColor: "#1f2937",
        });
      }
      fallbackName = "signed.pdf";
      break;
    }
    case "compare-pdf": {
      if (files.length < 2) {
        throw new AppError("INVALID_INPUT", "Compare needs two PDFs", {
          userMessage: "Add two PDFs to compare.",
        });
      }

      const [leftFile, rightFile] = files as [typeof files[0], typeof files[0]];
      const [leftText, rightText] = await Promise.all([
        client.pdfToText(leftFile!, { outputFormat: "txt" }),
        client.pdfToText(rightFile!, { outputFormat: "txt" }),
      ]);

      const html = buildComparisonHtml(
        leftFile!.filename,
        new TextDecoder("utf-8", { fatal: false }).decode(leftText.bytes),
        rightFile!.filename,
        new TextDecoder("utf-8", { fatal: false }).decode(rightText.bytes),
        { showUnchanged: Boolean(values.showUnchanged) },
      );

      result = await client.htmlToPdf({
        filename: "comparison.html",
        contentType: "text/html; charset=utf-8",
        bytes: new TextEncoder().encode(html) as Uint8Array<ArrayBuffer>,
      });
      fallbackName = "comparison.pdf";
      break;
    }
    case "pdf-to-markdown": {
      firstFile(files);
      result = await client.pdfToMarkdown(files[0]!);
      fallbackName = "document.md";
      break;
    }
    case "web-to-pdf": {
      const config = getServerConfig();
      const page = await captureWebPage(String(values.url ?? ""), {
        allowlist: config.security.urlAllowlist,
      });

      result = await client.htmlToPdf(page, { zoom: Number(values.zoom ?? 1) });
      fallbackName = "web-page.pdf";
      break;
    }
    case "workflows": {
      const config = parsePipelineConfig(String(values.pipelineConfig ?? ""));

      if (!config) {
        throw new AppError("INVALID_INPUT", "Workflow configuration is not valid", {
          userMessage: "Enter a valid workflow JSON object.",
        });
      }

      result = await client.pipeline(files, config);
      fallbackName = "workflow-output";
      break;
    }
    case "scan-pdf": {
      result = await client.imagesToPdf(files, {
        fitOption: String(values.fitOption ?? "fillPage") as
          "fillPage" | "fitDocumentToImage" | "fitDocumentToPage" | "maintainAspectRatio",
        colorType: String(values.colorType ?? "color") as "color" | "greyscale" | "blackwhite",
        autoRotate: Boolean(values.autoRotate),
      });
      fallbackName = "scanned.pdf";
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
