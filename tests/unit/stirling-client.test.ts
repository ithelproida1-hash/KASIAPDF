import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import { StirlingClient } from "@/lib/stirling/client";
import type { UploadedFile } from "@/lib/stirling/types";
import { fixtureBytes } from "../helpers/fixtures";

const CONFIG = {
  baseUrl: "http://stirling.local",
  apiKey: "test-key",
  timeoutMs: 500,
  healthTimeoutMs: 200,
};

function uploaded(name = "sample-a.pdf"): UploadedFile {
  return {
    filename: name,
    contentType: "application/pdf",
    bytes: fixtureBytes("pdfs/sample-a.pdf"),
  };
}

describe("StirlingClient", () => {
  it("sends files and merge options to the verified endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="merged.pdf"',
          },
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    const result = await client.mergePdfs([uploaded("first.pdf"), uploaded("second.pdf")], {
      sortType: "orderProvided",
      generateToc: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/general/merge-pdfs");
    expect(init.method).toBe("POST");

    const headers = new Headers(init.headers);
    expect(headers.get("x-api-key")).toBe("test-key");

    const form = init.body as FormData;
    const files = form.getAll("fileInput") as File[];
    expect(files.map((file) => file.name)).toEqual(["first.pdf", "second.pdf"]);
    expect(form.get("sortType")).toBe("orderProvided");
    expect(form.get("generateToc")).toBe("true");
    expect(form.get("removeCertSign")).toBe("true");

    expect(result.contentType).toBe("application/pdf");
    expect(result.contentDisposition).toContain("merged.pdf");
    expect(result.bytes.byteLength).toBe(4);
  });

  it("uses the verified split endpoint with page numbers", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/zip" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.splitPdf(uploaded(), { pageNumbers: "2,5-9" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/general/split-pages");
    expect((init.body as FormData).get("pageNumbers")).toBe("2,5-9");
  });

  it("sends page selection to the remove-pages endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.removePages(uploaded(), { pageNumbers: "2,4-6" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/general/remove-pages");
    expect((init.body as FormData).get("pageNumbers")).toBe("2,4-6");
  });

  it("sends a custom order to the rearrange-pages endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.rearrangePages(uploaded(), {
      customMode: "CUSTOM",
      pageNumbers: "3,1,2",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/general/rearrange-pages");
    const form = init.body as FormData;
    expect(form.get("customMode")).toBe("CUSTOM");
    expect(form.get("pageNumbers")).toBe("3,1,2");
  });

  it("sends watermark styling options", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.addWatermark(uploaded(), {
      watermarkText: "CONFIDENTIAL",
      fontSize: 48,
      rotation: 30,
      opacity: 0.4,
      customColor: "#ff0000",
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get("watermarkType")).toBe("text");
    expect(form.get("watermarkText")).toBe("CONFIDENTIAL");
    expect(form.get("fontSize")).toBe("48");
    expect(form.get("rotation")).toBe("30");
    expect(form.get("opacity")).toBe("0.4");
    expect(form.get("customColor")).toBe("#ff0000");
  });

  it("sends encryption options and falls back to the owner password", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.addPassword(uploaded(), {
      password: "secret",
      keyLength: 128,
      preventPrinting: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/security/add-password");
    const form = init.body as FormData;
    expect(form.get("password")).toBe("secret");
    expect(form.get("ownerPassword")).toBe("secret");
    expect(form.get("keyLength")).toBe("128");
    expect(form.get("preventPrinting")).toBe("true");
    expect(form.get("preventModify")).toBe("false");
  });

  it("sends the required redaction fields", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.autoRedact(uploaded(), {
      listOfText: "Order 1234",
      wholeWordSearch: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/security/auto-redact");
    const form = init.body as FormData;
    expect(form.get("listOfText")).toBe("Order 1234");
    expect(form.get("wholeWordSearch")).toBe("true");
    expect(form.get("customPadding")).toBe("0");
    expect(form.get("convertPDFToImage")).toBe("false");
  });

  it("fills forms through the form endpoint's file field", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.fillForm(uploaded(), { data: '{"name":"Asha"}', flatten: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/form/fill");
    const form = init.body as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(form.get("fileInput")).toBeNull();
    expect(form.get("data")).toBe('{"name":"Asha"}');
    expect(form.get("flatten")).toBe("true");
  });

  it("adds a text stamp with the verified add-stamp fields", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.addStamp(uploaded(), {
      stampType: "text",
      stampText: "Approved",
      position: 7,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/misc/add-stamp");
    const form = init.body as FormData;
    expect(form.get("stampType")).toBe("text");
    expect(form.get("stampText")).toBe("Approved");
    expect(form.get("pageNumbers")).toBe("all");
    expect(form.get("position")).toBe("7");
  });

  it("requests a server certificate signature", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.certSign(uploaded(), {
      certType: "SERVER",
      showSignature: true,
      reason: "Approved",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/security/cert-sign");
    const form = init.body as FormData;
    expect(form.get("certType")).toBe("SERVER");
    expect(form.get("showSignature")).toBe("true");
    expect(form.get("reason")).toBe("Approved");
  });

  it("serialises a workflow pipeline", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.pipeline([uploaded()], {
      name: "Prepare",
      pipeline: [{ operation: "/api/v1/misc/repair", parameters: {} }],
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/pipeline/handleData");
    const json = JSON.parse(String((init.body as FormData).get("json"))) as {
      name: string;
      pipeline: unknown[];
    };
    expect(json.name).toBe("Prepare");
    expect(json.pipeline).toEqual([{ operation: "/api/v1/misc/repair", parameters: {} }]);
  });

  it("uses the verified PDF to Markdown endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new TextEncoder().encode("# Title"), {
          status: 200,
          headers: { "content-type": "text/markdown" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    const result = await client.pdfToMarkdown(uploaded());

    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/convert/pdf/markdown");
    expect(result.contentType).toBe("text/markdown");
  });

  it("uses the PDF to Word endpoint with the requested format", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/msword" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    await client.pdfToWord(uploaded(), { outputFormat: "doc" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/convert/pdf/word");
    expect((init.body as FormData).get("outputFormat")).toBe("doc");
  });

  it("asks the PDF to Excel endpoint for the Stirling office converter", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: {
            "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);
    const result = await client.pdfToExcel(uploaded());

    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://stirling.local/api/v1/convert/pdf/xlsx?useStirlingOfficeConvert=true");
    expect(result.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("explains an empty 204 response instead of returning a blank file", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient(CONFIG);

    await expect(client.pdfToExcel(uploaded())).rejects.toMatchObject({
      code: "PROCESSING_FAILED",
      userMessage: "The processing engine found nothing it could convert in this file.",
    });
  });

  it("does not send an API key when none is configured", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient({ ...CONFIG, apiKey: undefined });
    await client.rotatePdf(uploaded(), { angle: 90 });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).has("x-api-key")).toBe(false);
  });

  it("sends Cloudflare Access service token headers when configured", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new StirlingClient({
      ...CONFIG,
      access: { clientId: "access-id", clientSecret: "access-secret" },
    });
    await client.rotatePdf(uploaded(), { angle: 180 });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("cf-access-client-id")).toBe("access-id");
    expect(headers.get("cf-access-client-secret")).toBe("access-secret");
  });

  it("maps authentication failures without exposing the body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("secret upstream detail", { status: 401 })),
    );

    const client = new StirlingClient(CONFIG);
    const promise = client.compressPdf(uploaded(), { optimizeLevel: 5 });

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      code: "STIRLING_UNAUTHORIZED",
      status: 502,
    });
  });

  it("maps client errors to STIRLING_REJECTED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad", { status: 422 })),
    );

    const client = new StirlingClient(CONFIG);
    await expect(client.mergePdfs([uploaded()], {})).rejects.toMatchObject({
      code: "STIRLING_REJECTED",
      status: 422,
    });
  });

  it("rejects JSON error documents returned with HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"error":"nope"}', {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const client = new StirlingClient(CONFIG);
    await expect(client.rotatePdf(uploaded(), { angle: 90 })).rejects.toMatchObject({
      code: "PROCESSING_FAILED",
    });
  });

  it("rejects empty responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array(), {
            status: 200,
            headers: { "content-type": "application/pdf" },
          }),
      ),
    );

    const client = new StirlingClient(CONFIG);
    await expect(client.pdfToImages(uploaded(), {})).rejects.toMatchObject({
      code: "PROCESSING_FAILED",
    });
  });

  it("times out slow requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("The operation was aborted.", "AbortError")),
            );
          }),
      ),
    );

    const client = new StirlingClient({ ...CONFIG, timeoutMs: 20 });
    await expect(client.compressPdf(uploaded(), { optimizeLevel: 5 })).rejects.toMatchObject({
      code: "STIRLING_TIMEOUT",
      status: 504,
    });
  });

  it("classifies network failures as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const client = new StirlingClient(CONFIG);
    await expect(client.compressPdf(uploaded(), { optimizeLevel: 5 })).rejects.toMatchObject({
      code: "STIRLING_UNAVAILABLE",
      status: 503,
    });
  });

  it("reports health without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ status: "ok", version: "1.2.3" })),
    );

    const client = new StirlingClient(CONFIG);
    const health = await client.getHealth();

    expect(health.reachable).toBe(true);
    expect(health.version).toBe("1.2.3");
    expect(health.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("explains that a PDF without form fields cannot be filled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    const client = new StirlingClient(CONFIG);

    await expect(
      client.fillForm(uploaded(), { data: '{"fullName":"Asha"}', flatten: false }),
    ).rejects.toMatchObject({
      code: "INVALID_PDF",
      status: 422,
      retryable: false,
    });
  });

  it("detects PDF payloads served as application/octet-stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
            status: 200,
            headers: { "content-type": "application/octet-stream" },
          }),
      ),
    );

    const client = new StirlingClient(CONFIG);
    const result = await client.pipeline([uploaded()], {
      name: "Prepare",
      pipeline: [{ operation: "/api/v1/misc/repair", parameters: {} }],
    });

    expect(result.contentType).toBe("application/pdf");
  });

  it("returns an unhealthy result when the probe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const client = new StirlingClient(CONFIG);
    const health = await client.getHealth();

    expect(health.reachable).toBe(false);
    expect(health.error).toBe("STIRLING_UNAVAILABLE");
  });
});
