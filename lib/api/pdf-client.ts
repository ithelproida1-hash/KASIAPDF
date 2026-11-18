/**
 * Browser-side transport for PDF tools.
 * Uses XMLHttpRequest so upload progress can be reported; fetch cannot do that
 * reliably across browsers yet.
 */

export type ToolResult = {
  blob: Blob;
  filename: string;
  contentType: string;
  requestId: string | null;
};

export type RunToolArgs = {
  toolId: string;
  files: File[];
  values: Record<string, string | number | boolean>;
  onUploadProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

export class ToolRequestError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { code: string; requestId?: string | null; retryable?: boolean },
  ) {
    super(message);
    this.name = "ToolRequestError";
    this.code = options.code;
    this.requestId = options.requestId ?? null;
    this.retryable = options.retryable ?? false;
  }
}

const REQUEST_TIMEOUT_MS = 300_000;

const EXTENSION_BY_MIME: Record<string, string> = {
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
};

function extensionFor(contentType: string): string {
  return EXTENSION_BY_MIME[contentType.split(";")[0]?.trim().toLowerCase() ?? ""] ?? "bin";
}

export function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;

  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return null;
    }
  }

  const plainMatch = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  return plainMatch?.[1]?.trim() ?? null;
}

async function readErrorBody(xhr: XMLHttpRequest): Promise<{
  message: string | null;
  code: string | null;
  requestId: string | null;
  retryable: boolean;
}> {
  const fallback = { message: null, code: null, requestId: null, retryable: false };
  const body: unknown = xhr.response;

  if (!(body instanceof Blob)) return fallback;

  try {
    const text = await body.text();
    const parsed = JSON.parse(text) as {
      error?: { message?: string; code?: string; requestId?: string; retryable?: boolean };
    };

    return {
      message: typeof parsed.error?.message === "string" ? parsed.error.message : null,
      code: typeof parsed.error?.code === "string" ? parsed.error.code : null,
      requestId: typeof parsed.error?.requestId === "string" ? parsed.error.requestId : null,
      retryable: parsed.error?.retryable === true,
    };
  } catch {
    return fallback;
  }
}

export async function runPdfTool({
  toolId,
  files,
  values,
  onUploadProgress,
  signal,
}: RunToolArgs): Promise<ToolResult> {
  if (signal?.aborted) {
    throw new ToolRequestError("Request cancelled", { code: "ABORTED" });
  }

  const form = new FormData();
  for (const file of files) {
    form.append("file", file, file.name);
  }

  for (const [key, value] of Object.entries(values)) {
    form.append(key, typeof value === "boolean" ? String(value) : String(value));
  }

  return new Promise<ToolResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/pdf/${encodeURIComponent(toolId)}`);
    xhr.responseType = "blob";
    xhr.timeout = REQUEST_TIMEOUT_MS;

    const abortHandler = () => xhr.abort();
    signal?.addEventListener("abort", abortHandler, { once: true });

    const cleanup = () => {
      signal?.removeEventListener("abort", abortHandler);
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onUploadProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };

    xhr.onload = () => {
      void (async () => {
        cleanup();

        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = xhr.response as Blob;
          const contentType =
            (xhr.getResponseHeader("Content-Type") ?? blob.type ?? "application/octet-stream")
              .split(";")[0]
              ?.trim() ?? "application/octet-stream";
          const filename =
            parseFilenameFromDisposition(xhr.getResponseHeader("Content-Disposition")) ??
            `${toolId}.${extensionFor(contentType)}`;

          resolve({
            blob,
            filename,
            contentType,
            requestId: xhr.getResponseHeader("X-Request-Id"),
          });
          return;
        }

        const error = await readErrorBody(xhr);
        reject(
          new ToolRequestError(
            error.message ?? "The file could not be processed. Please try again.",
            {
              code: error.code ?? `HTTP_${xhr.status}`,
              requestId: error.requestId ?? xhr.getResponseHeader("X-Request-Id"),
              retryable: error.retryable,
            },
          ),
        );
      })();
    };

    xhr.onerror = () => {
      cleanup();
      reject(
        new ToolRequestError(
          "The connection to the processing service was interrupted. Check your network and try again.",
          { code: "NETWORK", retryable: true },
        ),
      );
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(
        new ToolRequestError(
          "This operation took too long. Try a smaller file or try again later.",
          { code: "TIMEOUT", retryable: true },
        ),
      );
    };

    xhr.onabort = () => {
      cleanup();
      reject(new ToolRequestError("Request cancelled", { code: "ABORTED" }));
    };

    xhr.send(form);
  });
}

/** Triggers a browser download for a processed result. */
export function downloadResult(result: ToolResult): void {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Give the browser a moment to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
