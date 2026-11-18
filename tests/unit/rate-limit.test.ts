import { describe, expect, it } from "vitest";

import { checkRateLimit, resetRateLimits } from "@/lib/security/rate-limit";

describe("rate limiter", () => {
  it("allows requests up to the limit then blocks", () => {
    resetRateLimits();
    const options = { limit: 2, windowMs: 60_000 };

    expect(checkRateLimit("client", options, 1_000).allowed).toBe(true);
    expect(checkRateLimit("client", options, 1_000).allowed).toBe(true);

    const blocked = checkRateLimit("client", options, 1_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    resetRateLimits();
    const options = { limit: 1, windowMs: 1_000 };

    expect(checkRateLimit("client", options, 1_000).allowed).toBe(true);
    expect(checkRateLimit("client", options, 1_500).allowed).toBe(false);
    expect(checkRateLimit("client", options, 2_001).allowed).toBe(true);
  });

  it("tracks clients independently", () => {
    resetRateLimits();
    const options = { limit: 1, windowMs: 60_000 };

    expect(checkRateLimit("a", options, 1_000).allowed).toBe(true);
    expect(checkRateLimit("b", options, 1_000).allowed).toBe(true);
    expect(checkRateLimit("a", options, 1_000).allowed).toBe(false);
  });

  it("reports remaining allowance", () => {
    resetRateLimits();
    const result = checkRateLimit("client", { limit: 5, windowMs: 60_000 }, 1_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
