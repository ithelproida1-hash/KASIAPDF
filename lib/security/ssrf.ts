/**
 * SSRF protection for URL-based tools (Web to PDF, HTML capture).
 *
 * Phase 1 UI does not expose URL fetching, but the guard is implemented and
 * unit-tested now so Phase 3 cannot accidentally ship without it.
 */

export type SsrfOptions = {
  /** Exact hostnames or parent domains that may resolve to internal addresses. */
  allowlist?: readonly string[];
  allowedProtocols?: readonly string[];
};

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".localdomain"];

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value < 0 || value > 255) return null;
    octets.push(value);
  }

  return octets;
}

export function isBlockedIpv4(hostname: string): boolean {
  const octets = parseIpv4(hostname);
  if (!octets) return false;

  const [a = 0, b = 0] = octets;

  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast, reserved, broadcast

  return false;
}

export function isBlockedIpv6(hostname: string): boolean {
  const address = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (address === "::" || address === "::1") return true;

  const dottedTail = address.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dottedTail?.[1] && isBlockedIpv4(dottedTail[1])) return true;

  const groups = expandIpv6(address);

  if (groups) {
    // IPv4-mapped (::ffff:7f00:1) and deprecated IPv4-compatible forms.
    const firstFiveZero = groups.slice(0, 5).every((group) => group === 0);
    const mapped = firstFiveZero && (groups[5] === 0xffff || groups[5] === 0);
    const lastTwo = groups.slice(6, 8);

    if (mapped && lastTwo.length === 2) {
      const [high = 0, low = 0] = lastTwo;
      const dotted = `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
      return isBlockedIpv4(dotted);
    }
  }

  if (/^f[cd]/.test(address)) return true; // unique local
  if (/^fe[89ab]/.test(address)) return true; // link-local
  if (/^ff/.test(address)) return true; // multicast

  return false;
}

/** Expands an IPv6 literal into eight hextets, or null when malformed. */
function expandIpv6(address: string): number[] | null {
  const halves = address.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;

  if (halves.length === 2 && missing < 0) return null;
  if (halves.length === 1 && head.length !== 8) return null;

  const parts = [...head, ...Array.from({ length: Math.max(missing, 0) }, () => "0"), ...tail];
  if (parts.length !== 8) return null;

  const groups = parts.map((part) =>
    /^[0-9a-f]{1,4}$/.test(part) ? Number.parseInt(part, 16) : Number.NaN,
  );

  return groups.some(Number.isNaN) ? null : groups;
}

function hostnameMatchesAllowlist(hostname: string, allowlist: readonly string[]): boolean {
  return allowlist.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));
}

/**
 * Throws when a URL targets a non-public destination.
 * DNS rebinding is handled by `assertResolvableSafeUrl`, which resolves and
 * validates every address before the fetch is performed.
 */
export function assertSafeExternalUrl(rawUrl: string, options: SsrfOptions = {}): URL {
  const allowedProtocols = options.allowedProtocols ?? ["http:", "https:"];
  const allowlist = (options.allowlist ?? []).map((entry) => entry.toLowerCase());
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL is not valid");
  }

  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error("URL protocol is not allowed");
  }

  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

  if (!hostname) {
    throw new Error("URL must include a hostname");
  }

  if (hostnameMatchesAllowlist(hostname, allowlist)) {
    return url;
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("URL host is not allowed");
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error("URL host is not allowed");
  }

  if (isBlockedIpv4(hostname) || isBlockedIpv6(hostname)) {
    throw new Error("URL resolves to a private or reserved address");
  }

  // Only standard web ports are allowed; internal service ports must never be
  // reachable through URL tooling.
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("URL port is not allowed");
  }

  return url;
}

/** Resolves the hostname and validates every returned address. */
export async function assertResolvableSafeUrl(
  rawUrl: string,
  options: SsrfOptions = {},
): Promise<URL> {
  const url = assertSafeExternalUrl(rawUrl, options);
  const allowlist = (options.allowlist ?? []).map((entry) => entry.toLowerCase());

  if (hostnameMatchesAllowlist(url.hostname.toLowerCase(), allowlist)) {
    return url;
  }

  const { lookup } = await import("node:dns/promises");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });

  if (addresses.length === 0) {
    throw new Error("URL host could not be resolved");
  }

  for (const { address, family } of addresses) {
    const blocked = family === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address);
    if (blocked) {
      throw new Error("URL resolves to a private or reserved address");
    }
  }

  return url;
}
