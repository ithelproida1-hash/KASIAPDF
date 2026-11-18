import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AppError } from "@/lib/errors";

const fixturesDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "fixtures");

export function fixtureBytes(relativePath: string): Uint8Array<ArrayBuffer> {
  const buffer = readFileSync(join(fixturesDir, relativePath));
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy as Uint8Array<ArrayBuffer>;
}

export function fixtureFile(
  relativePath: string,
  options: { name?: string; type?: string } = {},
): File {
  const bytes = fixtureBytes(relativePath);
  const name = options.name ?? relativePath.split("/").pop() ?? "file";
  const type =
    options.type ??
    (name.endsWith(".pdf")
      ? "application/pdf"
      : name.endsWith(".png")
        ? "image/png"
        : name.endsWith(".jpg") || name.endsWith(".jpeg")
          ? "image/jpeg"
          : "application/octet-stream");

  return new File([bytes], name, { type });
}

export function textFile(content: string, name: string, type = "application/pdf"): File {
  return new File([content], name, { type });
}

export async function expectAppError(
  promise: Promise<unknown>,
  code: AppError["code"],
): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code !== code) {
        throw new Error(`Expected AppError ${code}, received ${error.code}`);
      }
      return error;
    }
    throw new Error(`Expected AppError ${code}, received ${String(error)}`);
  }

  throw new Error(`Expected AppError ${code}, but the promise resolved`);
}
