import { apiErrorBody, type AppError } from "@/lib/errors";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export function jsonErrorResponse(error: AppError, requestId: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    ...NO_STORE_HEADERS,
    "X-Request-Id": requestId,
    "X-Content-Type-Options": "nosniff",
  });

  if (error.status === 429) {
    headers.set("Retry-After", "60");
  }

  return new Response(JSON.stringify(apiErrorBody(error, requestId)), {
    status: error.status,
    headers,
  });
}

/**
 * Best-effort client identifier for rate limiting.
 * Vercel populates x-forwarded-for; the first address is the client.
 */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Encodes a filename for RFC 5987 Content-Disposition. */
export function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** ASCII-safe fallback filename for older clients. */
export function asciiFilename(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
}
