import { describe, expect, it } from "vitest";

import { detectFileKind, extensionOf, FILE_KIND_INFO } from "@/lib/files/file-kind";
import { expectAppError, fixtureFile, textFile } from "../helpers/fixtures";
import {
  ensureExtension,
  isDeclaredLengthOverLimit,
  sanitizeFilename,
  validateUploads,
} from "@/lib/security/validation";
import type { ToolInputSpec } from "@/lib/pdf/tools";

const PDF_INPUT: ToolInputSpec = {
  kinds: ["pdf"],
  multiple: true,
  minFiles: 2,
  maxFiles: 3,
  ordered: true,
  accept: ".pdf,application/pdf",
};

const LIMITS = {
  maxFileBytes: 50_000,
  maxTotalBytes: 100_000,
  maxFiles: 5,
};

describe("detectFileKind", () => {
  it("identifies supported signatures", () => {
    expect(detectFileKind(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe("pdf");
    expect(detectFileKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectFileKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "png",
    );
    expect(detectFileKind(new TextEncoder().encode("RIFF....WEBP"))).toBe("webp");
  });

  it("returns unknown for unsupported content", () => {
    expect(detectFileKind(new TextEncoder().encode("hello world"))).toBe("unknown");
    expect(detectFileKind(new Uint8Array())).toBe("unknown");
  });
});

describe("sanitizeFilename", () => {
  it("strips directory traversal and path separators", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("..\\..\\windows\\system32\\config")).toBe("config");
    expect(sanitizeFilename("/var/tmp/report.pdf")).toBe("report.pdf");
  });

  it("removes control and Windows-reserved characters", () => {
    expect(sanitizeFilename("in\u0000voice\u001f.pdf")).toBe("invoice.pdf");
    expect(sanitizeFilename('a<b>c:d"e|f?g*.pdf')).toBe("a-b-c-d-e-f-g-.pdf");
  });

  it("prevents hidden names and reserved device names", () => {
    expect(sanitizeFilename("...hidden.pdf")).toBe("hidden.pdf");
    expect(sanitizeFilename("CON.pdf")).toBe("file-CON.pdf");
    expect(sanitizeFilename("lpt1")).toBe("file-lpt1");
  });

  it("falls back when the name is unusable", () => {
    expect(sanitizeFilename("   ")).toBe("document");
    expect(sanitizeFilename("...")).toBe("document");
  });

  it("caps long names but preserves the extension", () => {
    const result = sanitizeFilename(`${"a".repeat(300)}.pdf`);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith(".pdf")).toBe(true);
  });
});

describe("ensureExtension", () => {
  it("corrects a mismatched extension", () => {
    expect(ensureExtension("photo.png", "jpeg")).toBe("photo.jpg");
    expect(ensureExtension("scan", "pdf")).toBe("scan.pdf");
    expect(ensureExtension("doc.pdf", "pdf")).toBe("doc.pdf");
  });

  it("knows its own extensions", () => {
    expect(extensionOf("REPORT.PDF")).toBe(".pdf");
    expect(FILE_KIND_INFO.jpeg.extensions).toContain(".jpeg");
  });
});

describe("validateUploads", () => {
  it("accepts valid files in the supplied order", async () => {
    const files = [fixtureFile("pdfs/sample-b.pdf"), fixtureFile("pdfs/sample-a.pdf")];
    const result = await validateUploads(files, PDF_INPUT, LIMITS);

    expect(result.files.map((file) => file.filename)).toEqual(["sample-b.pdf", "sample-a.pdf"]);
    expect(result.files.every((file) => file.contentType === "application/pdf")).toBe(true);
    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it("rejects too few files", async () => {
    await expectAppError(
      validateUploads([fixtureFile("pdfs/sample-a.pdf")], PDF_INPUT, LIMITS),
      "INVALID_INPUT",
    );
  });

  it("rejects too many files", async () => {
    const files = Array.from({ length: 4 }, () => fixtureFile("pdfs/sample-a.pdf"));
    await expectAppError(validateUploads(files, PDF_INPUT, LIMITS), "TOO_MANY_FILES");
  });

  it("rejects oversized files before reading them", async () => {
    const file = fixtureFile("pdfs/sample-a.pdf");
    await expectAppError(
      validateUploads([file, file], PDF_INPUT, { ...LIMITS, maxFileBytes: 10 }),
      "FILE_TOO_LARGE",
    );
  });

  it("rejects uploads that exceed the combined limit", async () => {
    const first = fixtureFile("pdfs/sample-a.pdf");
    const second = fixtureFile("pdfs/sample-b.pdf");
    await expectAppError(
      validateUploads([first, second], PDF_INPUT, {
        ...LIMITS,
        maxFileBytes: 5_000,
        maxTotalBytes: 700,
      }),
      "FILE_TOO_LARGE",
    );
  });

  it("rejects files without a PDF signature", async () => {
    const fake = textFile("plain text pretending to be a PDF", "fake.pdf");
    await expectAppError(
      validateUploads([fake, fixtureFile("pdfs/sample-a.pdf")], PDF_INPUT, LIMITS),
      "INVALID_PDF",
    );
  });

  it("rejects a mismatched file kind", async () => {
    const image = fixtureFile("images/pixel.png", { name: "image.png", type: "image/png" });
    await expectAppError(
      validateUploads([image, fixtureFile("pdfs/sample-a.pdf")], PDF_INPUT, LIMITS),
      "UNSUPPORTED_FILE_TYPE",
    );
  });

  it("rejects empty files", async () => {
    const empty = new File([], "empty.pdf", { type: "application/pdf" });
    await expectAppError(
      validateUploads([empty, fixtureFile("pdfs/sample-a.pdf")], PDF_INPUT, LIMITS),
      "INVALID_INPUT",
    );
  });
});

describe("isDeclaredLengthOverLimit", () => {
  it("handles missing and malformed headers", () => {
    expect(isDeclaredLengthOverLimit(null, 100)).toBe(false);
    expect(isDeclaredLengthOverLimit("not-a-number", 100)).toBe(false);
    expect(isDeclaredLengthOverLimit("99", 100)).toBe(false);
    expect(isDeclaredLengthOverLimit("101", 100)).toBe(true);
  });
});
