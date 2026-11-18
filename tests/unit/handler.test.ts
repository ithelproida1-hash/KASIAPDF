import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetServerConfigCache } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { resetMetrics } from "@/lib/metrics";
import { resetRateLimits } from "@/lib/security/rate-limit";
import { fixtureFile } from "../helpers/fixtures";

const mocks = vi.hoisted(() => ({
  mergePdfs: vi.fn(),
  splitPdf: vi.fn(),
  compressPdf: vi.fn(),
  rotatePdf: vi.fn(),
  imagesToPdf: vi.fn(),
  pdfToImages: vi.fn(),
}));

vi.mock("@/lib/stirling/client", () => ({
  createStirlingClient: () => mocks,
}));

import { handlePdfToolRequest } from "@/lib/pdf/handler";

const PDF_RESULT = {
  bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  contentType: "application/pdf",
};

function buildRequest(
  tool: string,
  files: File[] = [],
  values: Record<string, string> = {},
  headers: Record<string, string> = {},
): Request {
  const form = new FormData();
  for (const file of files) {
    form.append("file", file, file.name);
  }
  for (const [key, value] of Object.entries(values)) {
    form.append(key, value);
  }

  return new Request(`http://localhost/api/pdf/${tool}`, {
    method: "POST",
    body: form,
    headers,
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STIRLING_PDF_URL", "http://stirling.test");
  vi.stubEnv("STIRLING_PDF_API_KEY", "");
  vi.stubEnv("MAX_FILE_SIZE_MB", "5");
  vi.stubEnv("MAX_TOTAL_UPLOAD_MB", "10");
  vi.stubEnv("MAX_FILES_PER_JOB", "5");
  vi.stubEnv("RATE_LIMIT_PER_MINUTE", "100");

  resetServerConfigCache();
  resetRateLimits();
  resetMetrics();

  mocks.mergePdfs.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.splitPdf.mockReset().mockResolvedValue({ ...PDF_RESULT, contentType: "application/zip" });
  mocks.compressPdf.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.rotatePdf.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.imagesToPdf.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.pdfToImages.mockReset().mockResolvedValue({ ...PDF_RESULT, contentType: "image/jpeg" });
});

describe("PDF tool handler", () => {
  it("rejects unknown tools", async () => {
    const response = await handlePdfToolRequest(
      buildRequest("delete-everything"),
      "delete-everything",
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("TOOL_NOT_AVAILABLE");
  });

  it("rejects planned tools", async () => {
    const response = await handlePdfToolRequest(buildRequest("watermark-pdf"), "watermark-pdf");
    expect(response.status).toBe(404);
  });

  it("requires at least one file", async () => {
    const response = await handlePdfToolRequest(buildRequest("merge-pdf"), "merge-pdf");
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(mocks.mergePdfs).not.toHaveBeenCalled();
  });

  it("merges valid files and returns a safe download response", async () => {
    const request = buildRequest("merge-pdf", [
      fixtureFile("pdfs/sample-b.pdf"),
      fixtureFile("pdfs/sample-a.pdf"),
    ]);

    const response = await handlePdfToolRequest(request, "merge-pdf");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("merged.pdf");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(new Uint8Array(await response.arrayBuffer()).byteLength).toBe(4);

    expect(mocks.mergePdfs).toHaveBeenCalledTimes(1);
    const [files, options] = mocks.mergePdfs.mock.calls[0] as [
      Array<{ filename: string }>,
      Record<string, unknown>,
    ];
    expect(files.map((file) => file.filename)).toEqual(["sample-b.pdf", "sample-a.pdf"]);
    expect(options).toMatchObject({ sortType: "orderProvided", generateToc: false });
  });

  it("sanitises uploaded filenames before forwarding them", async () => {
    const request = buildRequest("merge-pdf", [
      fixtureFile("pdfs/sample-a.pdf", { name: "../../evil name.pdf" }),
      fixtureFile("pdfs/sample-b.pdf"),
    ]);

    await handlePdfToolRequest(request, "merge-pdf");

    const [files] = mocks.mergePdfs.mock.calls[0] as [Array<{ filename: string }>];
    expect(files[0]?.filename).toBe("evil name.pdf");
  });

  it("validates tool options", async () => {
    const request = buildRequest("split-pdf", [fixtureFile("pdfs/sample-a.pdf")], {
      pageNumbers: "not-a-range",
    });

    const response = await handlePdfToolRequest(request, "split-pdf");
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(body.error.message).toMatch(/page numbers or ranges/i);
    expect(mocks.splitPdf).not.toHaveBeenCalled();
  });

  it("applies split options and propagates the upstream filename", async () => {
    mocks.splitPdf.mockResolvedValueOnce({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "application/zip",
      contentDisposition: 'attachment; filename="split-documents.zip"',
    });

    const request = buildRequest("split-pdf", [fixtureFile("pdfs/sample-c.pdf")], {
      pageNumbers: "all",
    });

    const response = await handlePdfToolRequest(request, "split-pdf");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("split-documents.zip");
    expect(mocks.splitPdf).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "sample-c.pdf" }),
      { pageNumbers: "all" },
    );
  });

  it("maps engine timeouts to a 504 without leaking details", async () => {
    mocks.mergePdfs.mockRejectedValueOnce(
      new AppError("STIRLING_TIMEOUT", "connect timed out to http://stirling.internal:8080"),
    );

    const request = buildRequest("merge-pdf", [
      fixtureFile("pdfs/sample-a.pdf"),
      fixtureFile("pdfs/sample-b.pdf"),
    ]);

    const response = await handlePdfToolRequest(request, "merge-pdf");
    const payload = JSON.stringify(await response.json());

    expect(response.status).toBe(504);
    expect(payload).toContain("STIRLING_TIMEOUT");
    expect(payload).not.toMatch(/stirling\.internal|8080|connect timed out/);
  });

  it("enforces the rate limit per client", async () => {
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "1");
    resetServerConfigCache();
    resetRateLimits();

    const first = await handlePdfToolRequest(
      buildRequest("merge-pdf", [
        fixtureFile("pdfs/sample-a.pdf"),
        fixtureFile("pdfs/sample-b.pdf"),
      ]),
      "merge-pdf",
    );
    const second = await handlePdfToolRequest(
      buildRequest("merge-pdf", [
        fixtureFile("pdfs/sample-a.pdf"),
        fixtureFile("pdfs/sample-b.pdf"),
      ]),
      "merge-pdf",
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBeTruthy();
  });

  it("returns an empty-body error when the engine sends nothing", async () => {
    mocks.rotatePdf.mockResolvedValueOnce({
      bytes: new Uint8Array(),
      contentType: "application/pdf",
    });

    const response = await handlePdfToolRequest(
      buildRequest("rotate-pdf", [fixtureFile("pdfs/sample-a.pdf")], { angle: "90" }),
      "rotate-pdf",
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("PROCESSING_FAILED");
  });
});
