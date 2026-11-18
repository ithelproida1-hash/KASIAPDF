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
