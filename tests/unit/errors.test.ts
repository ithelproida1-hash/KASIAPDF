import { describe, expect, it } from "vitest";

import { AppError, apiErrorBody, toAppError } from "@/lib/errors";

describe("AppError", () => {
  it("maps codes to HTTP statuses", () => {
    expect(new AppError("INVALID_INPUT").status).toBe(400);
    expect(new AppError("FILE_TOO_LARGE").status).toBe(413);
    expect(new AppError("RATE_LIMITED").status).toBe(429);
    expect(new AppError("STIRLING_TIMEOUT").status).toBe(504);
    expect(new AppError("STIRLING_UNAVAILABLE").status).toBe(503);
    expect(new AppError("UNKNOWN").status).toBe(500);
  });

  it("never includes technical detail in the user message", () => {
    const error = new AppError(
      "STIRLING_UNAVAILABLE",
      "connect ECONNREFUSED http://10.0.0.4:8080",
      {
        details: { url: "http://internal:8080" },
      },
    );

    expect(error.userMessage).not.toMatch(/http|ECONNREFUSED|8080|internal/i);
    expect(apiErrorBody(error, "req-1").error.message).toBe(error.userMessage);
  });

  it("allows specific safe guidance", () => {
    const error = new AppError("INVALID_INPUT", "Too few files", {
      userMessage: "Add at least 2 files to use this tool.",
    });
    expect(error.userMessage).toBe("Add at least 2 files to use this tool.");
  });

  it("wraps unknown failures without leaking them", () => {
    const wrapped = toAppError(new Error("secret internal path C:\\Users\\x"));
    expect(wrapped.code).toBe("UNKNOWN");
    expect(wrapped.userMessage).not.toMatch(/C:\\\\|secret/);
    expect(wrapped.cause).toBeInstanceOf(Error);
  });

  it("passes AppError through unchanged", () => {
    const original = new AppError("INVALID_PDF");
    expect(toAppError(original)).toBe(original);
  });

  it("serialises a safe API error body", () => {
    const body = apiErrorBody(new AppError("INVALID_INPUT"), "request-123");

    expect(body).toEqual({
      error: {
        code: "INVALID_INPUT",
        message: expect.any(String),
        requestId: "request-123",
        retryable: false,
      },
    });
  });
});
