import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { archiveUploads } from "@/lib/storage/upload-archive";
import type { UploadedFile } from "@/lib/stirling/types";

const directories: string[] = [];

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pdf-archive-"));
  directories.push(directory);
  return directory;
}

function upload(name: string, content = "sample"): UploadedFile {
  return {
    filename: name,
    contentType: "application/pdf",
    bytes: new TextEncoder().encode(content) as Uint8Array<ArrayBuffer>,
  };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("upload archive", () => {
  it("writes uploads into a dated folder with unique safe names", async () => {
    const root = await tempDirectory();

    const folder = await archiveUploads({
      requestId: "req_123456789",
      toolId: "merge-pdf",
      files: [upload("../../Report A.pdf", "first"), upload("Report A.pdf", "second")],
      directory: root,
    });

    expect(folder).not.toBeNull();
    expect(folder!.startsWith(root)).toBe(true);

    const entries = await readdir(folder!);
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => !entry.includes(".."))).toBe(true);
    expect(entries.every((entry) => entry.endsWith(".pdf"))).toBe(true);
    expect(new Set(entries).size).toBe(2);

    const contents = await Promise.all(entries.map((entry) => readFile(join(folder!, entry), "utf8")));
    expect(contents.sort()).toEqual(["first", "second"]);

    const folderName = folder!.split(/[\\/]/).at(-1);
    expect(folderName).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does nothing when the backup is disabled or there are no files", async () => {
    const root = await tempDirectory();

    await expect(
      archiveUploads({
        requestId: "req_1",
        toolId: "merge-pdf",
        files: [upload("a.pdf")],
        directory: null,
      }),
    ).resolves.toBeNull();

    await expect(
      archiveUploads({
        requestId: "req_2",
        toolId: "merge-pdf",
        files: [],
        directory: root,
      }),
    ).resolves.toBeNull();

    await expect(stat(root)).resolves.toBeDefined();
    expect(await readdir(root)).toEqual([]);
  });

  it("never throws when the destination cannot be written", async () => {
    const root = await tempDirectory();
    const blocked = join(root, "not-a-directory");
    await writeFile(blocked, "file");

    await expect(
      archiveUploads({
        requestId: "req_3",
        toolId: "merge-pdf",
        files: [upload("a.pdf")],
        directory: blocked,
      }),
    ).resolves.toBeNull();
  });
});
