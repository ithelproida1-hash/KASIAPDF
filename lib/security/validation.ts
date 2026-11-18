import { AppError } from "@/lib/errors";
import { detectFileKind, FILE_KIND_INFO, extensionOf, type FileKind } from "@/lib/files/file-kind";
import type { ToolInputSpec } from "@/lib/pdf/tools";
import type { UploadedFile } from "@/lib/stirling/types";

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Office formats are detected as generic archives, so the uploaded part keeps
 * the MIME type implied by its accepted extension. This lets LibreOffice pick
 * the right conversion path.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".csv": "text/csv",
  ".rtf": "application/rtf",
  ".txt": "text/plain",
  ".html": "text/html",
  ".htm": "text/html",
};

/**
 * Produces a safe, predictable filename:
 * - strips directory components (path traversal)
 * - removes control characters and characters invalid on Windows
 * - prevents hidden files and Windows reserved device names
 * - caps the length while preserving the extension
 */
export function sanitizeFilename(input: string, fallback = "document"): string {
  const withoutPath = input.split(/[\\/]/).pop() ?? "";
  const normalised = withoutPath.normalize("NFKC");

  let cleaned = normalised
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");

  if (!cleaned) {
    cleaned = fallback;
  }

  if (WINDOWS_RESERVED.test(cleaned)) {
    cleaned = `file-${cleaned}`;
  }

  const maxLength = 120;
  if (cleaned.length > maxLength) {
    const extension = extensionOf(cleaned);
    const base = cleaned.slice(0, maxLength - extension.length).replace(/[.\s]+$/, "");
    cleaned = `${base || fallback}${extension}`;
  }

  return cleaned;
}

export function ensureExtension(filename: string, kind: Exclude<FileKind, "unknown">): string {
  const allowed = FILE_KIND_INFO[kind].extensions;
  if (allowed.includes(extensionOf(filename))) {
    return filename;
  }

  const base = filename.replace(/\.[^.]+$/, "") || "document";
  return `${base}${allowed[0]}`;
}

export type UploadLimits = {
  maxFileBytes: number;
  maxTotalBytes: number;
  maxFiles: number;
};

export type ValidateUploadsResult = {
  files: UploadedFile[];
  totalBytes: number;
};

function describeExpectedKinds(kinds: readonly FileKind[]): string {
  const labels = kinds
    .filter((kind): kind is Exclude<FileKind, "unknown"> => kind !== "unknown")
    .map((kind) => FILE_KIND_INFO[kind].label);

  if (labels.length === 0) return "a supported file";
  if (labels.length === 1) return labels[0] ?? "a supported file";
  return `${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}`;
}

/**
 * Validates untrusted uploads before they reach Stirling.
 * Reads each file into memory only after its declared size passes the limit.
 */
export async function validateUploads(
  rawFiles: readonly File[],
  input: ToolInputSpec,
  limits: UploadLimits,
): Promise<ValidateUploadsResult> {
  if (rawFiles.length < input.minFiles) {
    const minimum = input.minFiles;
    throw new AppError("INVALID_INPUT", "Too few files supplied", {
      userMessage:
        minimum > 1
          ? `Add at least ${minimum} files to use this tool.`
          : "Add a file to use this tool.",
    });
  }

  const maxFiles = Math.min(input.maxFiles, limits.maxFiles);
  if (rawFiles.length > maxFiles) {
    throw new AppError("TOO_MANY_FILES", "Too many files supplied", {
      userMessage: `You can add up to ${maxFiles} files at a time.`,
    });
  }

  if (!input.multiple && rawFiles.length > 1) {
    throw new AppError("TOO_MANY_FILES", "This tool accepts a single file", {
      userMessage: "This tool accepts one file at a time.",
    });
  }

  let totalBytes = 0;
  for (const file of rawFiles) {
    if (file.size === 0) {
      throw new AppError("INVALID_INPUT", "Empty file supplied", {
        userMessage: "One of the selected files is empty.",
      });
    }

    if (file.size > limits.maxFileBytes) {
      throw new AppError("FILE_TOO_LARGE", "File exceeds the per-file limit", {
        details: { size: file.size, limit: limits.maxFileBytes },
      });
    }

    totalBytes += file.size;
    if (totalBytes > limits.maxTotalBytes) {
      throw new AppError("FILE_TOO_LARGE", "Upload exceeds the total limit", {
        userMessage: "The selected files exceed the total upload limit.",
        details: { totalBytes, limit: limits.maxTotalBytes },
      });
    }
  }

  const files: UploadedFile[] = [];

  for (const file of rawFiles) {
    let buffer: ArrayBuffer;

    try {
      buffer = await file.arrayBuffer();
    } catch (error) {
      throw new AppError("INVALID_INPUT", "Could not read an uploaded file", { cause: error });
    }

    const bytes = new Uint8Array(buffer);
    const kind = detectFileKind(bytes);

    if (kind === "unknown") {
      const expectsPdf = input.kinds.includes("pdf");
      throw new AppError(
        expectsPdf ? "INVALID_PDF" : "UNSUPPORTED_FILE_TYPE",
        "Unknown file type",
        {
          userMessage: expectsPdf
            ? "This file does not appear to be a valid PDF."
            : `This file is not supported. Add ${describeExpectedKinds(input.kinds)}.`,
        },
      );
    }

    if (!input.kinds.includes(kind)) {
      throw new AppError("UNSUPPORTED_FILE_TYPE", "File kind not accepted by this tool", {
        details: { detected: kind },
        userMessage: `This tool accepts ${describeExpectedKinds(input.kinds)}.`,
      });
    }

    const safeName = sanitizeFilename(file.name || "document");
    const acceptedExtensions = new Set(
      input.accept
        .toLowerCase()
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.startsWith(".")),
    );
    const filename = acceptedExtensions.has(extensionOf(safeName))
      ? safeName
      : ensureExtension(safeName, kind as Exclude<FileKind, "unknown">);
    const extension = extensionOf(filename);
    const contentType =
      MIME_BY_EXTENSION[extension] ?? FILE_KIND_INFO[kind as Exclude<FileKind, "unknown">].mime;

    files.push({
      filename,
      contentType,
      bytes,
    });
  }

  return { files, totalBytes };
}

/** Rough guard against oversized requests before parsing multipart bodies. */
export function isDeclaredLengthOverLimit(
  contentLength: string | null,
  limitBytes: number,
): boolean {
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > limitBytes;
}
