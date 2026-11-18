import { getServerConfig, type ServerConfig } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";

import { STIRLING_ENDPOINTS } from "./endpoints";
import { mapUpstreamFailure } from "./errors";
import type {
  AddPasswordOptions,
  AddStampOptions,
  CertSignOptions,
  CompressOptions,
  CropOptions,
  FormExtractOptions,
  FormFillOptions,
  HtmlToPdfOptions,
  ImageToPdfOptions,
  MergeOptions,
  OcrOptions,
  PageNumberOptions,
  PdfTextOptions,
  PdfToImageOptions,
  PdfToPdfAOptions,
  PdfToPresentationOptions,
  PdfToWordOptions,
  PipelineOptions,
  RedactOptions,
  RemovePagesOptions,
  RemovePasswordOptions,
  RearrangePagesOptions,
  RotateOptions,
  SplitOptions,
  StirlingFileResult,
  StirlingHealth,
  StirlingStatusPayload,
  UploadedFile,
  WatermarkOptions,
} from "./types";

type StirlingConfig = ServerConfig["stirling"];

const DEFAULT_ACCEPT = "application/pdf, application/zip, image/*, application/octet-stream";

function appendFile(form: FormData, field: string, file: UploadedFile): void {
  form.append(field, new Blob([file.bytes], { type: file.contentType }), file.filename);
}

function appendBoolean(form: FormData, field: string, value: boolean | undefined): void {
  if (value === undefined) return;
  form.append(field, String(value));
}

function appendNumber(form: FormData, field: string, value: number | undefined): void {
  if (value === undefined) return;
  form.append(field, String(value));
}

function appendString(form: FormData, field: string, value: string | undefined): void {
  if (value === undefined || value === "") return;
  form.append(field, value);
}

/** True when the payload starts with the PDF signature (`%PDF-`). */
function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/**
 * Thin, typed wrapper around the Stirling-PDF REST API.
 * UI components must never import this module; all calls originate server-side.
 */
export class StirlingClient {
  private readonly config: StirlingConfig;

  constructor(config: StirlingConfig) {
    this.config = config;
  }

  private buildUrl(path: string): string {
    return `${this.config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private async request(
    path: string,
    init: RequestInit,
    timeoutMs: number = this.config.timeoutMs,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers(init.headers);

    if (this.config.apiKey) {
      headers.set("X-API-KEY", this.config.apiKey);
    }

    if (this.config.access) {
      headers.set("CF-Access-Client-Id", this.config.access.clientId);
      headers.set("CF-Access-Client-Secret", this.config.access.clientSecret);
    }

    headers.set("Accept", headers.get("Accept") ?? DEFAULT_ACCEPT);

    try {
      return await fetch(this.buildUrl(path), {
        ...init,
        headers,
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AppError("STIRLING_TIMEOUT", "Stirling request timed out", {
          retryable: true,
          details: { timeoutMs },
          cause: error,
        });
      }

      throw new AppError("STIRLING_UNAVAILABLE", "Stirling is unreachable", {
        retryable: true,
        details: { reason: "network" },
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Non-throwing health probe used by /api/health and the admin page. */
  async getHealth(): Promise<StirlingHealth> {
    const startedAt = performance.now();

    try {
      const response = await this.request(
        STIRLING_ENDPOINTS.status,
        { method: "GET", headers: { Accept: "application/json" } },
        this.config.healthTimeoutMs,
      );
      const responseTimeMs = Math.round(performance.now() - startedAt);

      if (!response.ok) {
        return {
          reachable: false,
          responseTimeMs,
          error: `status_${response.status}`,
        };
      }

      const payload = (await response.json().catch(() => ({}))) as StirlingStatusPayload;

      return {
        reachable: true,
        responseTimeMs,
        version: typeof payload.version === "string" ? payload.version : undefined,
        status: typeof payload.status === "string" ? payload.status : undefined,
      };
    } catch (error) {
      return {
        reachable: false,
        responseTimeMs: Math.round(performance.now() - startedAt),
        error: error instanceof AppError ? error.code : "unknown",
      };
    }
  }

  private async postForm(path: string, form: FormData): Promise<StirlingFileResult> {
    const response = await this.request(path, { method: "POST", body: form });

    if (!response.ok) {
      // Drain the body so sockets are released; never surface its contents.
      await response.body?.cancel().catch(() => undefined);
      logger.warn("Stirling returned a non-success status", {
        operation: path,
        status: response.status,
      });
      throw mapUpstreamFailure(response.status);
    }

    const contentType =
      (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0]?.trim() ??
      "application/octet-stream";

    // Some converters return 204 when the document has no content they can use.
    if (response.status === 204) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError("PROCESSING_FAILED", "Stirling returned no content", {
        userMessage: "The processing engine found nothing it could convert in this file.",
        details: { upstreamStatus: 204 },
      });
    }

    // Stirling serves JSON/HTML bodies for some failures even with HTTP 200.
    if (contentType.includes("application/json") || contentType.includes("text/html")) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError("PROCESSING_FAILED", "Stirling returned an error document", {
        details: { upstreamContentType: contentType },
      });
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength === 0) {
      throw new AppError("PROCESSING_FAILED", "Stirling returned an empty body");
    }

    const bytes = new Uint8Array(buffer);

    // Pipeline outputs are served as application/octet-stream even when the
    // payload is a PDF. Sniff the magic bytes so filenames and previews stay
    // correct for the browser.
    const resolvedContentType =
      contentType === "application/octet-stream" && looksLikePdf(bytes)
        ? "application/pdf"
        : contentType;

    return {
      bytes,
      contentType: resolvedContentType,
      contentDisposition: response.headers.get("content-disposition") ?? undefined,
    };
  }

  async mergePdfs(files: UploadedFile[], options: MergeOptions = {}): Promise<StirlingFileResult> {
    const form = new FormData();

    for (const file of files) {
      appendFile(form, "fileInput", file);
    }

    appendString(form, "sortType", options.sortType ?? "orderProvided");
    appendBoolean(form, "generateToc", options.generateToc ?? false);
    appendBoolean(form, "removeCertSign", options.removeCertSign ?? true);

    return this.postForm(STIRLING_ENDPOINTS.mergePdfs, form);
  }

  async splitPdf(file: UploadedFile, options: SplitOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "pageNumbers", options.pageNumbers);

    return this.postForm(STIRLING_ENDPOINTS.splitPages, form);
  }

  async compressPdf(file: UploadedFile, options: CompressOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendNumber(form, "optimizeLevel", options.optimizeLevel);
    appendBoolean(form, "grayscale", options.grayscale ?? false);
    appendBoolean(form, "linearize", options.linearize ?? false);
    appendBoolean(form, "normalize", options.normalize ?? false);

    return this.postForm(STIRLING_ENDPOINTS.compressPdf, form);
  }

  async rotatePdf(file: UploadedFile, options: RotateOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendNumber(form, "angle", options.angle);

    return this.postForm(STIRLING_ENDPOINTS.rotatePdf, form);
  }

  async imagesToPdf(
    files: UploadedFile[],
    options: ImageToPdfOptions = {},
  ): Promise<StirlingFileResult> {
    const form = new FormData();

    for (const file of files) {
      appendFile(form, "fileInput", file);
    }

    appendString(form, "fitOption", options.fitOption ?? "fillPage");
    appendString(form, "colorType", options.colorType ?? "color");
    appendBoolean(form, "autoRotate", options.autoRotate ?? false);

    return this.postForm(STIRLING_ENDPOINTS.imagesToPdf, form);
  }

  async pdfToImages(
    file: UploadedFile,
    options: PdfToImageOptions = {},
  ): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "imageFormat", options.imageFormat ?? "jpeg");
    appendString(form, "singleOrMultiple", options.singleOrMultiple ?? "multiple");
    appendString(form, "colorType", options.colorType ?? "color");
    appendNumber(form, "dpi", options.dpi ?? 300);
    appendString(form, "pageNumbers", options.pageNumbers ?? "all");

    return this.postForm(STIRLING_ENDPOINTS.pdfToImages, form);
  }

  async removePages(file: UploadedFile, options: RemovePagesOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "pageNumbers", options.pageNumbers);

    return this.postForm(STIRLING_ENDPOINTS.removePages, form);
  }

  async rearrangePages(
    file: UploadedFile,
    options: RearrangePagesOptions,
  ): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "pageNumbers", options.pageNumbers);
    appendString(form, "customMode", options.customMode);

    return this.postForm(STIRLING_ENDPOINTS.rearrangePages, form);
  }

  async cropPdf(file: UploadedFile, options: CropOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "pageNumbers", options.pageNumbers ?? "all");
    appendBoolean(form, "autoCrop", options.autoCrop ?? false);
    appendBoolean(form, "removeDataOutsideCrop", options.removeDataOutsideCrop ?? false);

    if (!options.autoCrop) {
      appendNumber(form, "x", options.x ?? 0);
      appendNumber(form, "y", options.y ?? 0);
      appendNumber(form, "width", options.width);
      appendNumber(form, "height", options.height);
    }

    return this.postForm(STIRLING_ENDPOINTS.cropPdf, form);
  }

  async pdfToWord(file: UploadedFile, options: PdfToWordOptions = {}): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "outputFormat", options.outputFormat ?? "docx");

    return this.postForm(STIRLING_ENDPOINTS.pdfToWord, form);
  }

  async pdfToPresentation(
    file: UploadedFile,
    options: PdfToPresentationOptions = {},
  ): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "outputFormat", options.outputFormat ?? "pptx");

    return this.postForm(STIRLING_ENDPOINTS.pdfToPresentation, form);
  }

  async pdfToExcel(file: UploadedFile): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);

    // The LibreOffice path returns an empty 204 for most PDFs; Stirling Office
    // Convert extracts the tables reliably and is enabled on this deployment.
    return this.postForm(`${STIRLING_ENDPOINTS.pdfToExcel}?useStirlingOfficeConvert=true`, form);
  }

  async fileToPdf(file: UploadedFile): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);

    return this.postForm(STIRLING_ENDPOINTS.fileToPdf, form);
  }

  async htmlToPdf(file: UploadedFile, options: HtmlToPdfOptions = {}): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendNumber(form, "zoom", options.zoom ?? 1);

    return this.postForm(STIRLING_ENDPOINTS.htmlToPdf, form);
  }

  async pdfToPdfA(file: UploadedFile, options: PdfToPdfAOptions = {}): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "outputFormat", options.outputFormat ?? "pdfa-2b");
    appendBoolean(form, "pdfUa", options.pdfUa ?? false);
    appendBoolean(form, "strict", options.strict ?? false);

    return this.postForm(STIRLING_ENDPOINTS.pdfToPdfA, form);
  }

  async addWatermark(
    file: UploadedFile,
    options: WatermarkOptions,
  ): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "watermarkType", "text");
    appendString(form, "watermarkText", options.watermarkText);
    appendNumber(form, "fontSize", options.fontSize ?? 36);
    appendNumber(form, "rotation", options.rotation ?? 45);
    appendNumber(form, "opacity", options.opacity ?? 0.25);
    appendString(form, "customColor", options.customColor ?? "#d3d3d3");
    appendBoolean(form, "convertPDFToImage", options.convertPDFToImage ?? false);

    return this.postForm(STIRLING_ENDPOINTS.addWatermark, form);
  }

  async addPageNumbers(
    file: UploadedFile,
    options: PageNumberOptions,
  ): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "pageNumbers", options.pageNumbers);
    appendString(form, "pagesToNumber", options.pageNumbers);
    appendString(form, "fontType", options.fontType ?? "helvetica");
    appendNumber(form, "position", options.position ?? 8);
    appendString(form, "customText", options.customText ?? "{n}");
    appendNumber(form, "startingNumber", options.startingNumber ?? 1);
    appendNumber(form, "fontSize", options.fontSize ?? 12);
    appendString(form, "fontColor", options.fontColor ?? "#000000");

    return this.postForm(STIRLING_ENDPOINTS.addPageNumbers, form);
  }

  async removePassword(
    file: UploadedFile,
    options: RemovePasswordOptions,
  ): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "password", options.password);
    appendBoolean(form, "removeAll", options.removeAll ?? true);

    return this.postForm(STIRLING_ENDPOINTS.removePassword, form);
  }

  async addPassword(file: UploadedFile, options: AddPasswordOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "password", options.password);
    appendString(form, "ownerPassword", options.ownerPassword || options.password);
    appendNumber(form, "keyLength", options.keyLength ?? 256);
    appendBoolean(form, "preventPrinting", options.preventPrinting ?? false);
    appendBoolean(form, "preventModify", options.preventModify ?? false);
    appendBoolean(form, "preventExtractContent", options.preventExtractContent ?? false);

    return this.postForm(STIRLING_ENDPOINTS.addPassword, form);
  }

  async ocrPdf(file: UploadedFile, options: OcrOptions = {}): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "languages", options.languages ?? "eng");
    appendString(form, "ocrType", options.ocrType ?? "skip-text");
    appendBoolean(form, "deskew", options.deskew ?? false);
    appendBoolean(form, "rotatePages", options.rotatePages ?? false);
    appendBoolean(form, "clean", options.clean ?? false);

    return this.postForm(STIRLING_ENDPOINTS.ocrPdf, form);
  }

  async repairPdf(file: UploadedFile): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);

    return this.postForm(STIRLING_ENDPOINTS.repairPdf, form);
  }

  async autoRedact(file: UploadedFile, options: RedactOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "listOfText", options.listOfText);
    appendBoolean(form, "useRegex", options.useRegex ?? false);
    appendBoolean(form, "wholeWordSearch", options.wholeWordSearch ?? false);
    appendBoolean(form, "caseSensitive", options.caseSensitive ?? false);
    appendString(form, "redactColor", options.redactColor ?? "#000000");
    appendNumber(form, "customPadding", 0);
    appendBoolean(form, "convertPDFToImage", options.convertPDFToImage ?? false);

    return this.postForm(STIRLING_ENDPOINTS.autoRedact, form);
  }

  async fillForm(file: UploadedFile, options: FormFillOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    // The form endpoints name the upload field "file", unlike most converters.
    appendFile(form, "file", file);
    appendString(form, "data", options.data);
    appendBoolean(form, "flatten", options.flatten ?? false);

    try {
      return await this.postForm(STIRLING_ENDPOINTS.fillForm, form);
    } catch (error) {
      // Stirling throws an internal 500 ("No AcroForm present in document") for
      // ordinary PDFs that simply have no form fields. That is a property of
      // the upload, not a transient engine fault, so do not offer a retry.
      if (error instanceof AppError && error.details?.upstreamStatus === 500) {
        throw new AppError("INVALID_PDF", "Uploaded PDF has no AcroForm", {
          userMessage:
            "This PDF has no fillable form fields. Use Export CSV to see the fields it does contain.",
        });
      }

      throw error;
    }
  }

  async extractFormCsv(
    file: UploadedFile,
    options: FormExtractOptions = {},
  ): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "file", file);
    appendString(form, "data", options.data);

    return this.postForm(STIRLING_ENDPOINTS.extractFormCsv, form);
  }

  async extractFormXlsx(
    file: UploadedFile,
    options: FormExtractOptions = {},
  ): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "file", file);
    appendString(form, "data", options.data);

    return this.postForm(STIRLING_ENDPOINTS.extractFormXlsx, form);
  }

  async addStamp(file: UploadedFile, options: AddStampOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "pageNumbers", options.pageNumbers ?? "all");
    appendString(form, "stampType", options.stampType);
    appendString(form, "stampText", options.stampText);
    appendNumber(form, "position", options.position ?? 8);
    appendNumber(form, "fontSize", options.fontSize ?? 24);
    appendNumber(form, "opacity", options.opacity ?? 0.8);
    appendString(form, "customColor", options.customColor ?? "#000000");
    appendNumber(form, "rotation", options.rotation ?? 0);
    appendString(form, "customMargin", options.customMargin ?? "medium");
    appendNumber(form, "overrideX", options.overrideX ?? -1);
    appendNumber(form, "overrideY", options.overrideY ?? -1);

    if (options.stampImage) {
      appendFile(form, "stampImage", options.stampImage);
    }

    return this.postForm(STIRLING_ENDPOINTS.addStamp, form);
  }

  async certSign(file: UploadedFile, options: CertSignOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "certType", options.certType);
    appendBoolean(form, "showSignature", options.showSignature ?? true);
    appendBoolean(form, "showLogo", options.showLogo ?? true);
    appendString(form, "reason", options.reason);
    appendString(form, "location", options.location);
    appendString(form, "name", options.name);
    appendNumber(form, "pageNumber", options.pageNumber ?? 1);

    return this.postForm(STIRLING_ENDPOINTS.certSign, form);
  }

  async pdfToMarkdown(file: UploadedFile): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);

    return this.postForm(STIRLING_ENDPOINTS.pdfToMarkdown, form);
  }

  async pdfToText(
    file: UploadedFile,
    options: PdfTextOptions = {},
  ): Promise<StirlingFileResult> {
    const form = new FormData();
    appendFile(form, "fileInput", file);
    appendString(form, "outputFormat", options.outputFormat ?? "txt");

    return this.postForm(STIRLING_ENDPOINTS.pdfToText, form);
  }

  async pipeline(files: UploadedFile[], options: PipelineOptions): Promise<StirlingFileResult> {
    const form = new FormData();
    for (const file of files) {
      appendFile(form, "fileInput", file);
    }

    form.append("json", JSON.stringify({ name: options.name, pipeline: options.pipeline }));

    return this.postForm(STIRLING_ENDPOINTS.pipeline, form);
  }
}

export function createStirlingClient(
  config: ServerConfig["stirling"] = getServerConfig().stirling,
): StirlingClient {
  return new StirlingClient(config);
}
