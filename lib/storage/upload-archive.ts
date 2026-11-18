import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { logger } from "@/lib/logging/logger";
import { sanitizeFilename } from "@/lib/security/validation";
import type { UploadedFile } from "@/lib/stirling/types";

/**
 * Local upload backup.
 *
 * Every accepted upload is written to a dated folder before it is sent to the
 * engine. The archive is intentionally independent of the processing result so
 * a failed conversion still keeps the original document.
 *
 * Filenames are sanitised and prefixed with a timestamp, the tool id and the
 * request id, so two uploads can never overwrite each other.
 */

export type ArchiveOptions = {
  requestId: string;
  toolId: string;
  files: readonly UploadedFile[];
  directory: string | null;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateParts(date: Date): { day: string; stamp: string } {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const stamp = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${String(
    date.getMilliseconds(),
  ).padStart(3, "0")}`;

  return { day, stamp };
}

function archiveName(index: number, stamp: string, toolId: string, requestId: string, name: string) {
  const safe = sanitizeFilename(name, "upload");
  const suffix = safe.slice(-80);
  return `${stamp}__${toolId}__${requestId.slice(0, 8)}__${index + 1}-${suffix}`;
}

/**
 * Archives uploads and returns the folder used. Never throws: a backup failure
 * must not stop the user's PDF from being processed.
 */
export async function archiveUploads(options: ArchiveOptions): Promise<string | null> {
  if (!options.directory || options.files.length === 0) {
    return null;
  }

  const root = resolve(options.directory);
  const now = new Date();
  const { day, stamp } = dateParts(now);
  const folder = join(root, day);

  try {
    await mkdir(folder, { recursive: true });

    for (const [index, file] of options.files.entries()) {
      const filename = archiveName(index, stamp, options.toolId, options.requestId, file.filename);
      await writeFile(join(folder, filename), Buffer.from(file.bytes), { flag: "wx" });
    }

    logger.info("Uploaded files archived", {
      requestId: options.requestId,
      tool: options.toolId,
      count: options.files.length,
    });

    return folder;
  } catch (error) {
    logger.error("Upload archive failed", {
      requestId: options.requestId,
      tool: options.toolId,
      error: error instanceof Error ? error.message : "unknown",
    });

    return null;
  }
}
