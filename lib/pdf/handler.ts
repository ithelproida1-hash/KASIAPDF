import { getClientKey, encodeRFC5987, asciiFilename, jsonErrorResponse } from "@/lib/api/response";
import { getServerConfig } from "@/lib/config/env";
import { AppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { recordToolRun } from "@/lib/metrics";
import { getToolForm, readToolValues, validateToolValues } from "@/lib/pdf/tool-options";
import { executeTool } from "@/lib/pdf/tool-specs";
import { getToolBySlug } from "@/lib/pdf/tools";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isDeclaredLengthOverLimit, validateUploads } from "@/lib/security/validation";
import { archiveUploads } from "@/lib/storage/upload-archive";
import { createStirlingClient } from "@/lib/stirling/client";
import { createId } from "@/lib/utils";

/** Extra room for multipart boundaries and option fields. */
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

export async function handlePdfToolRequest(request: Request, toolSlug: string): Promise<Response> {
  const requestId = createId();
  const startedAt = performance.now();
  const tool = getToolBySlug(toolSlug);

  try {
    const config = getServerConfig();

    if (request.method !== "POST") {
      throw new AppError("INVALID_INPUT", "Unsupported method", {
        userMessage: "Use POST to submit files to this tool.",
      });
    }

    if (!tool || tool.status !== "available" || !tool.endpoint) {
      throw new AppError("TOOL_NOT_AVAILABLE", "Tool is not implemented", {
        details: { tool: toolSlug },
        userMessage: "This tool is not available yet.",
      });
    }

    const form = getToolForm(tool.id);
    if (!form) {
      throw new AppError("TOOL_NOT_AVAILABLE", "Tool has no form configuration", {
        details: { tool: tool.id },
      });
    }

    const limit = checkRateLimit(`pdf:${getClientKey(request)}`, {
      limit: config.limits.rateLimitPerMinute,
      windowMs: 60_000,
    });

    if (!limit.allowed) {
      throw new AppError("RATE_LIMITED", "Rate limit exceeded", {
        retryable: true,
        details: { retryAfterSeconds: limit.retryAfterSeconds },
      });
    }

    if (
      isDeclaredLengthOverLimit(
        request.headers.get("content-length"),
        config.limits.maxTotalUploadBytes + MULTIPART_OVERHEAD_BYTES,
      )
    ) {
      throw new AppError("FILE_TOO_LARGE", "Declared request body exceeds the upload limit");
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      throw new AppError("INVALID_INPUT", "Malformed multipart request", { cause: error });
    }

    const rawFiles = formData
      .getAll("file")
      .filter((entry): entry is File => typeof entry !== "string" && entry.size >= 0);

    const { files, totalBytes } = await validateUploads(rawFiles, tool.input, {
      maxFileBytes: config.limits.maxFileBytes,
      maxTotalBytes: config.limits.maxTotalUploadBytes,
      maxFiles: config.limits.maxFilesPerJob,
    });

    const rawValues = readToolValues(formData, form);
    const validation = validateToolValues(form, rawValues);

    if (!validation.success) {
      throw new AppError("INVALID_INPUT", "Tool options failed validation", {
        userMessage: validation.message,
        details: { field: validation.field },
      });
    }

    await archiveUploads({
      requestId,
      toolId: tool.id,
      files,
      directory: config.backup.enabled ? config.backup.directory : null,
    });

    const client = createStirlingClient(config.stirling);
    const { result, filename } = await executeTool(tool, client, files, validation.values);

    if (result.bytes.byteLength === 0) {
      throw new AppError("PROCESSING_FAILED", "Stirling returned an empty document", {
        retryable: true,
      });
    }

    const headers = new Headers({
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${asciiFilename(filename)}"; filename*=UTF-8''${encodeRFC5987(filename)}`,
      "Content-Length": String(result.bytes.byteLength),
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-Content-Type-Options": "nosniff",
    });

    recordToolRun({ tool: tool.id, success: true, durationMs: performance.now() - startedAt });
    logger.info("PDF tool completed", {
      requestId,
      tool: tool.id,
      status: 200,
      durationMs: Math.round(performance.now() - startedAt),
      fileCount: files.length,
      totalBytes,
      environment: config.environment,
    });

    return new Response(result.bytes, { status: 200, headers });
  } catch (error) {
    const appError = toAppError(error);

    logger.error("PDF tool failed", {
      requestId,
      tool: tool?.id ?? toolSlug,
      status: appError.status,
      errorCode: appError.code,
      durationMs: Math.round(performance.now() - startedAt),
    });

    if (appError.code === "UNKNOWN") {
      // Configuration/startup errors land here; keep details server-side only.
      logger.error("Unhandled tool error", {
        requestId,
        errorCode: appError.code,
        message: appError.cause instanceof Error ? appError.cause.message : appError.message,
      });
    }

    recordToolRun({
      tool: tool?.id ?? toolSlug,
      success: false,
      durationMs: performance.now() - startedAt,
    });

    return jsonErrorResponse(appError, requestId);
  }
}
