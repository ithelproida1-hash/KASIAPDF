import { getPresenceStats, recordPresence } from "@/lib/analytics/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "jk_visitor";
const VISITOR_ID_PATTERN = /^[a-z0-9-]{8,64}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readCookie(header: string | null): string | null {
  if (!header) return null;

  for (const entry of header.split(";")) {
    const [name, ...valueParts] = entry.trim().split("=");
    if (name === VISITOR_COOKIE) {
      const value = decodeURIComponent(valueParts.join("="));
      return VISITOR_ID_PATTERN.test(value) ? value : null;
    }
  }

  return null;
}

function readVisitorId(request: Request): { id: string | null; fromCookie: boolean } {
  // The dashboard sends a stable id from localStorage. The cookie is a fallback
  // for clients without JS storage, so the daily count stays unique.
  const header = request.headers.get("x-visitor-id")?.trim();
  if (header && VISITOR_ID_PATTERN.test(header)) return { id: header, fromCookie: false };

  return { id: readCookie(request.headers.get("cookie")), fromCookie: true };
}

function createVisitorId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function visitorCookie(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${VISITOR_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

/**
 * Presence endpoint.
 *
 * Default (`GET /api/presence`) records the caller as active and returns the
 * daily/online counts. `GET /api/presence?peek=1` only reads the counts, which
 * the dashboard uses for its refresh, so viewing stats does not inflate them.
 */
export async function GET(request: Request): Promise<Response> {
  const now = Date.now();
  const peek = new URL(request.url).searchParams.get("peek") === "1";
  const existing = readVisitorId(request);
  const visitorId = existing.id ?? (peek ? null : createVisitorId());
  const stats = !peek && visitorId ? recordPresence(visitorId, now) : getPresenceStats(now);

  const headers = new Headers({
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  });

  if (!peek && visitorId && !existing.fromCookie && UUID_PATTERN.test(visitorId)) {
    headers.append("Set-Cookie", visitorCookie(visitorId));
  }

  return new Response(
    JSON.stringify({
      ...stats,
      updatedAt: new Date(now).toISOString(),
    }),
    { status: 200, headers },
  );
}
