import { getServerConfig, type ServerConfig } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";

import { STIRLING_ENDPOINTS } from "./endpoints";
import { mapUpstreamFailure } from "./errors";
import type {
  CompressOptions,
  ImageToPdfOptions,
  MergeOptions,
  PdfToImageOptions,
  RotateOptions,
  SplitOptions,
  StirlingFileResult,
  StirlingHealth,
  StirlingStatusPayload,
  UploadedFile,
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

    return {
      bytes: new Uint8Array(buffer),
      contentType,
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
}

export function createStirlingClient(
  config: ServerConfig["stirling"] = getServerConfig().stirling,
): StirlingClient {
  return new StirlingClient(config);
}
