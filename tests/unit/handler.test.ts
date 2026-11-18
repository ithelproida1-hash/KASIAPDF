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
  removePages: vi.fn(),
  rearrangePages: vi.fn(),
  cropPdf: vi.fn(),
  pdfToWord: vi.fn(),
  pdfToPresentation: vi.fn(),
  pdfToExcel: vi.fn(),
  fileToPdf: vi.fn(),
  htmlToPdf: vi.fn(),
  pdfToPdfA: vi.fn(),
  addWatermark: vi.fn(),
  addPageNumbers: vi.fn(),
  removePassword: vi.fn(),
  addPassword: vi.fn(),
  ocrPdf: vi.fn(),
  repairPdf: vi.fn(),
  autoRedact: vi.fn(),
  fillForm: vi.fn(),
  extractFormCsv: vi.fn(),
  extractFormXlsx: vi.fn(),
  addStamp: vi.fn(),
  certSign: vi.fn(),
  pdfToMarkdown: vi.fn(),
  pdfToText: vi.fn(),
  pipeline: vi.fn(),
}));

vi.mock("@/lib/stirling/client", () => ({
  createStirlingClient: () => mocks,
}));

import { handlePdfToolRequest } from "@/lib/pdf/handler";

const PDF_RESULT = {
  bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  contentType: "application/pdf",
};

const OFFICE_RESULTS = {
  docx: {
    bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  pptx: {
    bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  xlsx: {
    bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
} as const;

function zipFile(name = "sample.docx"): File {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])], name);
}

function htmlFile(name = "page.html"): File {
  return new File(["<!doctype html><html><body>Hello</body></html>"], name, { type: "text/html" });
}

function buildRequest(
  tool: string,
  files: File[] = [],
  values: Record<string, string | number | boolean> = {},
  headers: Record<string, string> = {},
): Request {
  const form = new FormData();
  for (const file of files) {
    form.append("file", file, file.name);
  }
  for (const [key, value] of Object.entries(values)) {
    form.append(key, String(value));
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
  mocks.removePages.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.rearrangePages.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.cropPdf.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.pdfToWord.mockReset().mockResolvedValue(OFFICE_RESULTS.docx);
  mocks.pdfToPresentation.mockReset().mockResolvedValue(OFFICE_RESULTS.pptx);
  mocks.pdfToExcel.mockReset().mockResolvedValue(OFFICE_RESULTS.xlsx);
  mocks.fileToPdf.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.htmlToPdf.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.pdfToPdfA.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.addWatermark.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.addPageNumbers.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.removePassword.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.addPassword.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.ocrPdf.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.repairPdf.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.autoRedact.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.fillForm.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.extractFormCsv.mockReset().mockResolvedValue({
    bytes: new Uint8Array([0x61, 0x2c, 0x62]),
    contentType: "text/csv",
  });
  mocks.extractFormXlsx.mockReset().mockResolvedValue(OFFICE_RESULTS.xlsx);
  mocks.addStamp.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.certSign.mockReset().mockResolvedValue(PDF_RESULT);
  mocks.pdfToMarkdown.mockReset().mockResolvedValue({
    bytes: new TextEncoder().encode("# Heading\n\nBody"),
    contentType: "text/markdown",
  });
  mocks.pdfToText.mockReset().mockResolvedValue({
    bytes: new TextEncoder().encode("Alpha\nBeta"),
    contentType: "text/plain",
  });
  mocks.pipeline.mockReset().mockResolvedValue(PDF_RESULT);
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
    const response = await handlePdfToolRequest(
      buildRequest("ai-summarize", [fixtureFile("pdfs/sample-a.pdf")]),
      "ai-summarize",
    );
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

  it("calls the engine with the expected options for every Phase 1 tool", async () => {
    const cases = [
      {
        tool: "compress-pdf",
        files: ["pdfs/sample-a.pdf"],
        values: { optimizeLevel: "7", grayscale: "true", linearize: "true" },
        method: "compressPdf",
        options: { optimizeLevel: 7, grayscale: true, linearize: true },
        filename: "compressed.pdf",
      },
      {
        tool: "rotate-pdf",
        files: ["pdfs/sample-a.pdf"],
        values: { angle: "270" },
        method: "rotatePdf",
        options: { angle: 270 },
        filename: "rotated.pdf",
      },
      {
        tool: "jpg-to-pdf",
        files: ["images/pixel.jpg", "images/pixel.png"],
        values: { fitOption: "fitDocumentToPage", colorType: "greyscale", autoRotate: "true" },
        method: "imagesToPdf",
        options: {
          fitOption: "fitDocumentToPage",
          colorType: "greyscale",
          autoRotate: true,
        },
        filename: "images.pdf",
      },
      {
        tool: "pdf-to-jpg",
        files: ["pdfs/sample-a.pdf"],
        values: {
          imageFormat: "png",
          dpi: "150",
          singleOrMultiple: "single",
          colorType: "greyscale",
        },
        method: "pdfToImages",
        options: {
          imageFormat: "png",
          dpi: 150,
          singleOrMultiple: "single",
          colorType: "greyscale",
        },
        filename: "page-image.jpg",
      },
    ] as const;

    for (const testCase of cases) {
      const response = await handlePdfToolRequest(
        buildRequest(
          testCase.tool,
          testCase.files.map((file) => fixtureFile(file)),
          testCase.values,
        ),
        testCase.tool,
      );

      expect(response.status, testCase.tool).toBe(200);
      expect(response.headers.get("content-disposition"), testCase.tool).toContain(
        testCase.filename,
      );

      const spy = mocks[testCase.method] as ReturnType<typeof vi.fn>;
      const [, options] = spy.mock.calls.at(-1) as [unknown, unknown];
      expect(options, testCase.tool).toEqual(testCase.options);
    }
  });

  it("calls the engine with the expected options for every Phase 2 tool", async () => {
    const pdf = () => fixtureFile("pdfs/sample-a.pdf");
    const office = () => zipFile();

    const cases = [
      {
        tool: "remove-pages",
        files: [pdf()],
        values: { pageNumbers: "2" },
        method: "removePages",
        args: [{ pageNumbers: "2" }],
        filename: "pages-removed.pdf",
      },
      {
        tool: "extract-pages",
        files: [pdf()],
        values: { pageNumbers: "1,3" },
        method: "rearrangePages",
        args: [{ customMode: "CUSTOM", pageNumbers: "1,3" }],
        filename: "extracted-pages.pdf",
      },
      {
        tool: "organize-pdf",
        files: [pdf()],
        values: { customMode: "REVERSE_ORDER", pageNumbers: "1" },
        method: "rearrangePages",
        args: [{ customMode: "REVERSE_ORDER", pageNumbers: "1" }],
        filename: "organized.pdf",
      },
      {
        tool: "pdf-to-word",
        files: [pdf()],
        values: { outputFormat: "docx", ocrBeforeConversion: "false" },
        method: "pdfToWord",
        args: [{ outputFormat: "docx" }],
        filename: "document.docx",
      },
      {
        tool: "pdf-to-powerpoint",
        files: [pdf()],
        values: { outputFormat: "pptx" },
        method: "pdfToPresentation",
        args: [{ outputFormat: "pptx" }],
        filename: "presentation.pptx",
      },
      {
        tool: "pdf-to-excel",
        files: [pdf()],
        values: {},
        method: "pdfToExcel",
        args: [],
        filename: "spreadsheet.xlsx",
      },
      {
        tool: "word-to-pdf",
        files: [office()],
        values: {},
        method: "fileToPdf",
        args: [],
        filename: "converted.pdf",
      },
      {
        tool: "powerpoint-to-pdf",
        files: [office()],
        values: {},
        method: "fileToPdf",
        args: [],
        filename: "converted.pdf",
      },
      {
        tool: "excel-to-pdf",
        files: [office()],
        values: {},
        method: "fileToPdf",
        args: [],
        filename: "converted.pdf",
      },
      {
        tool: "html-to-pdf",
        files: [htmlFile()],
        values: { zoom: "2" },
        method: "htmlToPdf",
        args: [{ zoom: 2 }],
        filename: "rendered.pdf",
      },
      {
        tool: "pdf-to-pdfa",
        files: [pdf()],
        values: { outputFormat: "pdfa-3b", strict: "true" },
        method: "pdfToPdfA",
        args: [{ outputFormat: "pdfa-3b", strict: true }],
        filename: "archival.pdf",
      },
      {
        tool: "watermark-pdf",
        files: [pdf()],
        values: {
          watermarkText: "DRAFT",
          fontSize: "48",
          rotation: "30",
          opacity: "0.5",
          customColor: "#ff0000",
        },
        method: "addWatermark",
        args: [
          {
            watermarkText: "DRAFT",
            fontSize: 48,
            rotation: 30,
            opacity: 0.5,
            customColor: "#ff0000",
          },
        ],
        filename: "watermarked.pdf",
      },
      {
        tool: "page-numbers",
        files: [pdf()],
        values: {
          pageNumbers: "all",
          fontType: "courier",
          position: "9",
          customText: "Page {n}",
          startingNumber: "3",
          fontSize: "14",
          fontColor: "#333333",
        },
        method: "addPageNumbers",
        args: [
          {
            pageNumbers: "all",
            fontType: "courier",
            position: 9,
            customText: "Page {n}",
            startingNumber: 3,
            fontSize: 14,
            fontColor: "#333333",
          },
        ],
        filename: "numbered.pdf",
      },
      {
        tool: "crop-pdf",
        files: [pdf()],
        values: { autoCrop: "false", pageNumbers: "all", x: "10", y: "12", width: "500", height: "700" },
        method: "cropPdf",
        args: [
          { autoCrop: false, pageNumbers: "all", x: 10, y: 12, width: 500, height: 700 },
        ],
        filename: "cropped.pdf",
      },
      {
        tool: "unlock-pdf",
        files: [pdf()],
        values: { password: "secret", removeAll: "true" },
        method: "removePassword",
        args: [{ password: "secret", removeAll: true }],
        filename: "unlocked.pdf",
      },
      {
        tool: "protect-pdf",
        files: [pdf()],
        values: {
          password: "secret",
          ownerPassword: "owner",
          keyLength: "128",
          preventPrinting: "true",
          preventModify: "false",
          preventExtractContent: "true",
        },
        method: "addPassword",
        args: [
          {
            password: "secret",
            ownerPassword: "owner",
            keyLength: 128,
            preventPrinting: true,
            preventModify: false,
            preventExtractContent: true,
          },
        ],
        filename: "protected.pdf",
      },
      {
        tool: "ocr-pdf",
        files: [pdf()],
        values: {
          languages: "deu",
          ocrType: "force-ocr",
          deskew: "true",
          rotatePages: "false",
          clean: "true",
        },
        method: "ocrPdf",
        args: [
          {
            languages: "deu",
            ocrType: "force-ocr",
            deskew: true,
            rotatePages: false,
            clean: true,
          },
        ],
        filename: "searchable.pdf",
      },
      {
        tool: "repair-pdf",
        files: [pdf()],
        values: {},
        method: "repairPdf",
        args: [],
        filename: "repaired.pdf",
      },
      {
        tool: "redact-pdf",
        files: [pdf()],
        values: {
          listOfText: "Order 1234",
          useRegex: "false",
          wholeWordSearch: "true",
          caseSensitive: "false",
          redactColor: "#111111",
        },
        method: "autoRedact",
        args: [
          {
            listOfText: "Order 1234",
            useRegex: false,
            wholeWordSearch: true,
            caseSensitive: false,
            redactColor: "#111111",
          },
        ],
        filename: "redacted.pdf",
      },
      {
        tool: "edit-pdf",
        files: [pdf()],
        values: {
          stampText: "Approved",
          pageNumbers: "all",
          position: "8",
          fontSize: "24",
          opacity: "0.8",
          rotation: "0",
          customColor: "#000000",
        },
        method: "addStamp",
        args: [
          {
            stampType: "text",
            stampText: "Approved",
            pageNumbers: "all",
            position: 8,
            fontSize: 24,
            opacity: 0.8,
            rotation: 0,
            customColor: "#000000",
          },
        ],
        filename: "edited.pdf",
      },
      {
        tool: "pdf-forms",
        files: [pdf()],
        values: { mode: "fill", data: '{"name":"Asha"}', flatten: "true" },
        method: "fillForm",
        args: [{ data: '{"name":"Asha"}', flatten: true }],
        filename: "filled-form.pdf",
      },
      {
        tool: "sign-pdf",
        files: [pdf()],
        values: {
          signatureType: "typed",
          stampText: "Asha Sharma",
          pageNumbers: "all",
          position: "8",
          fontSize: "24",
        },
        method: "addStamp",
        args: [
          {
            stampType: "text",
            stampText: "Asha Sharma",
            pageNumbers: "all",
            position: 8,
            fontSize: 24,
            opacity: 1,
            rotation: 0,
            customColor: "#1f2937",
          },
        ],
        filename: "signed.pdf",
      },
      {
        tool: "pdf-to-markdown",
        files: [pdf()],
        values: {},
        method: "pdfToMarkdown",
        args: [],
        filename: "document.md",
      },
      {
        tool: "scan-pdf",
        files: [fixtureFile("images/pixel.jpg"), fixtureFile("images/pixel.png")],
        values: { fitOption: "fitDocumentToPage", colorType: "greyscale", autoRotate: "true" },
        method: "imagesToPdf",
        args: [
          { fitOption: "fitDocumentToPage", colorType: "greyscale", autoRotate: true },
        ],
        filename: "scanned.pdf",
      },
    ] as const;

    for (const testCase of cases) {
      const response = await handlePdfToolRequest(
        buildRequest(testCase.tool, [...testCase.files], testCase.values),
        testCase.tool,
      );

      expect(response.status, testCase.tool).toBe(200);
      expect(response.headers.get("content-disposition"), testCase.tool).toContain(
        testCase.filename,
      );

      const spy = mocks[testCase.method] as ReturnType<typeof vi.fn>;
      const call = spy.mock.calls.at(-1) as unknown[];
      expect(call.slice(1), testCase.tool).toEqual(testCase.args);
    }
  });

  it("builds a comparison report from both documents", async () => {
    mocks.pdfToText
      .mockResolvedValueOnce({
        bytes: new TextEncoder().encode("Alpha\nBeta"),
        contentType: "text/plain",
      })
      .mockResolvedValueOnce({
        bytes: new TextEncoder().encode("Alpha\nGamma"),
        contentType: "text/plain",
      });

    const response = await handlePdfToolRequest(
      buildRequest(
        "compare-pdf",
        [fixtureFile("pdfs/sample-a.pdf"), fixtureFile("pdfs/sample-b.pdf")],
        { showUnchanged: "false" },
      ),
      "compare-pdf",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("comparison.pdf");

    const [comparisonFile] = mocks.htmlToPdf.mock.calls.at(-1) as [
      { filename: string; contentType: string; bytes: Uint8Array },
    ];
    const html = new TextDecoder().decode(comparisonFile.bytes);

    expect(comparisonFile.filename).toBe("comparison.html");
    expect(comparisonFile.contentType).toContain("text/html");
    expect(html).toContain("Comparison report");
    expect(html).toContain("Beta");
    expect(html).toContain("Gamma");
    expect(html).not.toContain(">Alpha<");
  });

  it("OCRs scanned PDFs before converting them to Word by default", async () => {
    const response = await handlePdfToolRequest(
      buildRequest("pdf-to-word", [fixtureFile("pdfs/sample-a.pdf")]),
      "pdf-to-word",
    );

    expect(response.status).toBe(200);
    expect(mocks.ocrPdf).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "sample-a.pdf" }),
      { languages: "eng", ocrType: "skip-text" },
    );
    expect(mocks.pdfToWord).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "sample-a.pdf",
        contentType: "application/pdf",
        bytes: PDF_RESULT.bytes,
      }),
      { outputFormat: "docx" },
    );
  });

  it("applies the server certificate signature", async () => {
    const response = await handlePdfToolRequest(
      buildRequest("sign-pdf", [fixtureFile("pdfs/sample-a.pdf")], {
        signatureType: "certificate",
        name: "Asha Sharma",
        reason: "Approved",
        location: "Kasia",
        showSignature: "true",
        showLogo: "false",
      }),
      "sign-pdf",
    );

    expect(response.status).toBe(200);
    expect(mocks.certSign).toHaveBeenCalledWith(expect.anything(), {
      certType: "SERVER",
      showSignature: true,
      showLogo: false,
      name: "Asha Sharma",
      reason: "Approved",
      location: "Kasia",
      pageNumber: 1,
    });
  });

  it("runs a workflow pipeline", async () => {
    const pipelineConfig = JSON.stringify({
      name: "Prepare for email",
      pipeline: [{ operation: "/api/v1/misc/repair", parameters: {} }],
    });

    const response = await handlePdfToolRequest(
      buildRequest("workflows", [fixtureFile("pdfs/sample-a.pdf")], { pipelineConfig }),
      "workflows",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("workflow-output.pdf");

    const [, config] = mocks.pipeline.mock.calls.at(-1) as [
      unknown[],
      { name: string; pipeline: unknown[] },
    ];
    expect(config.name).toBe("Prepare for email");
    expect(config.pipeline).toEqual([{ operation: "/api/v1/misc/repair", parameters: {} }]);
  });

  it("blocks private addresses for Web to PDF", async () => {
    const response = await handlePdfToolRequest(
      buildRequest("web-to-pdf", [], { url: "http://127.0.0.1/admin", zoom: "1" }),
      "web-to-pdf",
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(mocks.htmlToPdf).not.toHaveBeenCalled();
  });

  it("keeps the original Office extension and content type", async () => {
    const response = await handlePdfToolRequest(
      buildRequest("word-to-pdf", [zipFile("Report.DOCX")]),
      "word-to-pdf",
    );

    expect(response.status).toBe(200);

    const [file] = mocks.fileToPdf.mock.calls.at(-1) as [
      { filename: string; contentType: string },
    ];
    expect(file.filename).toBe("Report.DOCX");
    expect(file.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("maps engine rejections for every Phase 1 tool", async () => {
    const cases = [
      { tool: "merge-pdf", files: ["pdfs/sample-a.pdf", "pdfs/sample-b.pdf"], method: "mergePdfs" },
      { tool: "split-pdf", files: ["pdfs/sample-a.pdf"], method: "splitPdf" },
      { tool: "compress-pdf", files: ["pdfs/sample-a.pdf"], method: "compressPdf" },
      { tool: "rotate-pdf", files: ["pdfs/sample-a.pdf"], method: "rotatePdf" },
      { tool: "jpg-to-pdf", files: ["images/pixel.jpg"], method: "imagesToPdf" },
      { tool: "pdf-to-jpg", files: ["pdfs/sample-a.pdf"], method: "pdfToImages" },
    ] as const;

    for (const testCase of cases) {
      const spy = mocks[testCase.method] as ReturnType<typeof vi.fn>;
      spy.mockRejectedValueOnce(new AppError("STIRLING_REJECTED", "upstream said no"));

      const response = await handlePdfToolRequest(
        buildRequest(
          testCase.tool,
          testCase.files.map((file) => fixtureFile(file)),
        ),
        testCase.tool,
      );
      const body = (await response.json()) as { error: { code: string; message: string } };

      expect(response.status, testCase.tool).toBe(422);
      expect(body.error.code, testCase.tool).toBe("STIRLING_REJECTED");
      expect(JSON.stringify(body), testCase.tool).not.toContain("upstream said no");
    }
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
