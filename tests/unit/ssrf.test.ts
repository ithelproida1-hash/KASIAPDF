import { describe, expect, it } from "vitest";

import { assertSafeExternalUrl, isBlockedIpv4, isBlockedIpv6 } from "@/lib/security/ssrf";

describe("SSRF guard", () => {
  it.each([
    "http://localhost/admin",
    "http://LOCALHOST:8080/",
    "http://127.0.0.1/",
    "http://127.1.2.3/",
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://224.0.0.1/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://printer.local/",
    "http://service.internal/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "http://user:pass@example.com/",
    "http://example.com:6379/",
  ])("blocks %s", (url) => {
    expect(() => assertSafeExternalUrl(url)).toThrow();
  });

  it("allows ordinary public URLs", () => {
    expect(assertSafeExternalUrl("https://example.com/page?q=1").hostname).toBe("example.com");
    expect(assertSafeExternalUrl("https://docs.example.co.uk").protocol).toBe("https:");
    expect(assertSafeExternalUrl("http://example.com:443/").port).toBe("443");
  });

  it("allows explicit allowlist overrides", () => {
    const url = assertSafeExternalUrl("http://localhost:8080/", { allowlist: ["localhost"] });
    expect(url.hostname).toBe("localhost");
  });

  it("rejects malformed URLs", () => {
    expect(() => assertSafeExternalUrl("not a url")).toThrow();
    expect(() => assertSafeExternalUrl("")).toThrow();
  });

  it("classifies IPv4 ranges correctly", () => {
    expect(isBlockedIpv4("192.168.0.1")).toBe(true);
    expect(isBlockedIpv4("8.8.8.8")).toBe(false);
    expect(isBlockedIpv4("172.15.0.1")).toBe(false);
    expect(isBlockedIpv4("172.32.0.1")).toBe(false);
  });

  it("classifies IPv6 ranges correctly", () => {
    expect(isBlockedIpv6("::1")).toBe(true);
    expect(isBlockedIpv6("::")).toBe(true);
    expect(isBlockedIpv6("fc00::1")).toBe(true);
    expect(isBlockedIpv6("2001:4860:4860::8888")).toBe(false);
  });
});
