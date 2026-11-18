/**
 * Opaque, browser-local visitor id used for anonymous activity counts.
 * No fingerprinting or personal data is involved.
 */

const STORAGE_KEY = "jk-visitor-id";
const VISITOR_ID_PATTERN = /^[a-z0-9-]{8,64}$/i;

export function getVisitorId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VISITOR_ID_PATTERN.test(stored)) return stored;

    let id: string;
    if (typeof crypto.randomUUID === "function") {
      id = crypto.randomUUID();
    } else {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Storage can be blocked (private mode, policy). The API still issues a
    // cookie-based id, so the counts continue to work.
    return null;
  }
}
