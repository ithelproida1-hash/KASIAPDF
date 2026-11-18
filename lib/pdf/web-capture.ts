import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";

import { AppError } from "@/lib/errors";
import { assertSafeExternalUrl, isBlockedIpv4, isBlockedIpv6 } from "@/lib/security/ssrf";
import type { UploadedFile } from "@/lib/stirling/types";

/**
 * Server-side capture for the Web to PDF tool.
 *
 * Stirling's own URL converter is disabled on this deployment, so the page is
 * fetched here and passed to the HTML-to-PDF converter. The fetch resolves DNS
 * once, validates every address and pins the connection to that address, which
 * closes the DNS-rebinding gap between validation and request.
 */

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 20_000;

type CaptureOptions = {
  allowlist?: readonly string[];
};

type PinnedAddress = { address: string; family: number };

type RawResponse = {
  status: number;
  location?: string;
  contentType: string;
  body: Uint8Array;
};

function hostnameAllowed(hostname: string, allowlist: readonly string[]): boolean {
  const normalised = hostname.toLowerCase();
  return allowlist.some((entry) => {
    const domain = entry.toLowerCase().trim();
    return domain.length > 0 && (normalised === domain || normalised.endsWith(`.${domain}`));
  });
}

async function resolvePinnedAddress(hostname: string, allowInternal: boolean): Promise<PinnedAddress> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0) {
    throw new AppError("INVALID_INPUT", "URL host could not be resolved", {
      userMessage: "That address could not be found. Check the link and try again.",
    });
  }

  if (!allowInternal) {
    for (const { address, family } of addresses) {
      const blocked = family === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address);
      if (blocked) {
        throw new AppError("INVALID_INPUT", "URL resolves to a private address", {
          userMessage: "Only public web pages can be captured.",
        });
      }
    }
  }

  const chosen = addresses[0]!;
  return { address: chosen.address, family: chosen.family };
}

function requestOnce(url: URL, pinned: PinnedAddress): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "User-Agent": "JindalKasiaPDF/1.0 (web-to-pdf)",
        Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      // Pin Node's DNS lookup to the address validated above. Node may ask for
      // every address (`all: true`) when happy-eyeballs is enabled, in which
      // case the callback expects an array rather than (address, family).
      lookup: ((hostname: string, options: unknown, callback: (...args: unknown[]) => void) => {
        const wantsAll = Boolean((options as { all?: boolean } | undefined)?.all);

        if (wantsAll) {
          callback(null, [{ address: pinned.address, family: pinned.family }]);
          return;
        }

        callback(null, pinned.address, pinned.family);
      }) as RequestOptions["lookup"],
    };

    // Keep TLS SNI/host validation on the original hostname rather than the IP.
    if (url.protocol === "https:") {
      (options as RequestOptions & { servername?: string }).servername = url.hostname;
    }

    const request = transport(options, (response: IncomingMessage) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      const contentType = String(response.headers["content-type"] ?? "");

      if (status >= 300 && status < 400 && location) {
        response.resume();
        settled = true;
        resolve({
          status,
          location,
          contentType,
          body: new Uint8Array(),
        });
        return;
      }

      if (status < 200 || status >= 300) {
        response.resume();
        fail(
          new AppError("STIRLING_REJECTED", "Web page returned a non-success status", {
            userMessage: "That web page could not be loaded. It may be private or unavailable.",
            details: { status },
          }),
        );
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;

      response.on("data", (chunk: Buffer) => {
        if (settled) return;
        size += chunk.length;

        if (size > MAX_HTML_BYTES) {
          response.destroy();
          fail(
            new AppError("FILE_TOO_LARGE", "Web page exceeds the capture limit", {
              userMessage: "That page is too large to capture. Try a simpler page.",
            }),
          );
          return;
        }

        chunks.push(chunk);
      });

      response.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({ status, contentType, body: new Uint8Array(Buffer.concat(chunks)) });
      });

      response.on("error", fail);
    });

    request.on("timeout", () => {
      request.destroy();
      fail(
        new AppError("STIRLING_TIMEOUT", "Web page request timed out", {
          retryable: true,
          userMessage: "That web page took too long to respond. Try again in a moment.",
        }),
      );
    });

    request.on("error", (error) => {
      fail(
        new AppError("STIRLING_UNAVAILABLE", "Web page request failed", {
          retryable: true,
          userMessage: "The web page could not be reached. Check the link and try again.",
          cause: error,
        }),
      );
    });

    request.end();
  });
}

function charsetOf(contentType: string): string {
  const match = contentType.match(/charset\s*=\s*"?([^";\s]+)"?/i);
  return match?.[1]?.trim() ?? "utf-8";
}

function decodeBody(body: Uint8Array, contentType: string): string {
  const charset = charsetOf(contentType);

  try {
    return new TextDecoder(charset, { fatal: false }).decode(body);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(body);
  }
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/** Adds a <base> element so relative CSS and images resolve in the renderer. */
function withBaseElement(html: string, url: URL): string {
  if (/<base[\s>]/i.test(html)) return html;

  const base = `<base href="${escapeAttribute(url.toString())}">`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}\n${base}`);
  }

  return `<!doctype html><html><head><meta charset="utf-8">${base}</head><body>${html}</body></html>`;
}

export async function captureWebPage(
  rawUrl: string,
  options: CaptureOptions = {},
): Promise<UploadedFile> {
  const allowlist = options.allowlist ?? [];
  let current: URL;

  try {
    current = assertSafeExternalUrl(rawUrl, { allowlist });
  } catch (error) {
    throw new AppError("INVALID_INPUT", "URL rejected by the SSRF guard", {
      userMessage:
        "That link cannot be captured. Use a public http or https address without a custom port.",
      cause: error,
    });
  }

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const allowInternal = hostnameAllowed(current.hostname, allowlist);
    const pinned = await resolvePinnedAddress(current.hostname, allowInternal);
    const response = await requestOnce(current, pinned);

    if (response.location) {
      if (redirect === MAX_REDIRECTS) {
        throw new AppError("INVALID_INPUT", "Too many redirects", {
          userMessage: "That link redirected too many times. Try the final address instead.",
        });
      }

      try {
        current = assertSafeExternalUrl(new URL(response.location, current).toString(), {
          allowlist,
        });
      } catch (error) {
        throw new AppError("INVALID_INPUT", "Redirect target rejected", {
          userMessage: "That link redirected to an address that cannot be captured.",
          cause: error,
        });
      }

      continue;
    }

    const contentType = response.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
    const isHtml = contentType === "text/html" || contentType === "application/xhtml+xml";
    const isText = contentType === "text/plain";

    if (!isHtml && !isText) {
      throw new AppError("UNSUPPORTED_FILE_TYPE", "Web page is not HTML", {
        userMessage: "That link is not a web page. Use a link that opens as a normal page.",
        details: { contentType },
      });
    }

    const decoded = decodeBody(response.body, response.contentType);
    const html = isText
      ? `<!doctype html><html><head><meta charset="utf-8"></head><body><pre>${decoded
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")}</pre></body></html>`
      : withBaseElement(decoded, current);

    return {
      filename: "web-page.html",
      contentType: "text/html; charset=utf-8",
      bytes: new TextEncoder().encode(html) as Uint8Array<ArrayBuffer>,
    };
  }

  throw new AppError("INVALID_INPUT", "Too many redirects", {
    userMessage: "That link redirected too many times.",
  });
}
