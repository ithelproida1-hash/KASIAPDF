import { detectFileKind, FILE_KIND_INFO, type FileKind } from "@/lib/files/file-kind";
import type { ToolInputSpec } from "@/lib/pdf/tools";
import { formatBytes } from "@/lib/utils";
import type { PublicLimits } from "@/lib/api/limits";

export type SelectedFile = {
  id: string;
  file: File;
};

export type FileInspection = { ok: true; kind: FileKind } | { ok: false; message: string };

function expectedLabel(kinds: readonly FileKind[]): string {
  return kinds
    .filter((kind): kind is Exclude<FileKind, "unknown"> => kind !== "unknown")
    .map((kind) => FILE_KIND_INFO[kind].label)
    .join(", ");
}

/** Fast client-side pre-check. The server repeats every check authoritatively. */
export async function inspectFile(
  file: File,
  input: ToolInputSpec,
  limits: PublicLimits,
  currentTotalBytes: number,
): Promise<FileInspection> {
  if (file.size === 0) {
    return { ok: false, message: "This file is empty." };
  }

  const maxFileBytes = limits.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxFileBytes) {
    return { ok: false, message: `Files must be ${limits.maxFileSizeMb} MB or smaller.` };
  }

  if (currentTotalBytes + file.size > limits.maxTotalUploadMb * 1024 * 1024) {
    return {
      ok: false,
      message: `The total upload must stay under ${limits.maxTotalUploadMb} MB.`,
    };
  }

  let bytes: Uint8Array;
  try {
    const head = await file.slice(0, 1024).arrayBuffer();
    bytes = new Uint8Array(head);
  } catch {
    return { ok: false, message: "This file could not be read." };
  }

  const kind = detectFileKind(bytes);

  if (kind === "unknown") {
    return {
      ok: false,
      message: input.kinds.includes("pdf")
        ? "This does not look like a valid PDF."
        : `Unsupported file. Add ${expectedLabel(input.kinds)}.`,
    };
  }

  if (!input.kinds.includes(kind)) {
    return { ok: false, message: `This tool accepts ${expectedLabel(input.kinds)}.` };
  }

  return { ok: true, kind };
}

export function totalSizeOf(files: readonly SelectedFile[]): number {
  return files.reduce((total, entry) => total + entry.file.size, 0);
}

export function describeTotalSize(files: readonly SelectedFile[]): string {
  return formatBytes(totalSizeOf(files));
}
