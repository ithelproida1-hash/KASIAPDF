import { describe, expect, it } from "vitest";

import { parseServerConfig } from "@/lib/config/env";

describe("server environment", () => {
  it("uses safe local defaults", () => {
    const config = parseServerConfig({ NODE_ENV: "test" });

    expect(config.stirling.baseUrl).toBe("http://localhost:8080");
    expect(config.stirling.access).toBeUndefined();
    expect(config.limits.maxFilesPerJob).toBe(10);
    expect(config.environment).toBe("test");
  });

  it("normalises the Stirling URL and reads the API key", () => {
    const config = parseServerConfig({
      NODE_ENV: "test",
      STIRLING_PDF_URL: "https://pdf-engine.example.com/",
      STIRLING_PDF_API_KEY: "  secret-key  ",
    });

    expect(config.stirling.baseUrl).toBe("https://pdf-engine.example.com");
    expect(config.stirling.apiKey).toBe("secret-key");
  });

  it("rejects credentials embedded in the URL", () => {
    expect(() =>
      parseServerConfig({
        NODE_ENV: "test",
        STIRLING_PDF_URL: "https://user:pass@pdf-engine.example.com",
      }),
    ).toThrow(/STIRLING_PDF_URL/);
  });

  it("accepts a Cloudflare Access service token pair", () => {
    const config = parseServerConfig({
      NODE_ENV: "test",
      CLOUDFLARE_ACCESS_CLIENT_ID: "id.access",
      CLOUDFLARE_ACCESS_CLIENT_SECRET: "secret",
    });

    expect(config.stirling.access).toEqual({ clientId: "id.access", clientSecret: "secret" });
  });

  it("rejects a half-configured Access token", () => {
    expect(() =>
      parseServerConfig({
        NODE_ENV: "test",
        CLOUDFLARE_ACCESS_CLIENT_ID: "id.access",
      }),
    ).toThrow(/CLOUDFLARE_ACCESS_CLIENT_SECRET/);
  });

  it("rejects a total upload limit below the per-file limit", () => {
    expect(() =>
      parseServerConfig({
        NODE_ENV: "test",
        MAX_FILE_SIZE_MB: "100",
        MAX_TOTAL_UPLOAD_MB: "50",
      }),
    ).toThrow(/MAX_TOTAL_UPLOAD_MB/);
  });

  it("disables the upload backup during tests unless explicitly configured", () => {
    const config = parseServerConfig({ NODE_ENV: "test" });
    expect(config.backup.enabled).toBe(false);
    expect(config.backup.directory).toBeNull();
  });

  it("enables a default upload backup outside tests", () => {
    const config = parseServerConfig({ NODE_ENV: "production" });
    expect(config.backup.enabled).toBe(true);
    expect(config.backup.directory).toBe("storage/uploads");
  });

  it("honours a custom backup directory and explicit opt-out", () => {
    const custom = parseServerConfig({
      NODE_ENV: "production",
      UPLOAD_BACKUP_DIR: "D:/PDF-Backups",
    });
    expect(custom.backup).toEqual({ enabled: true, directory: "D:/PDF-Backups" });

    for (const value of ["", "off", "false", "none"]) {
      const disabled = parseServerConfig({ NODE_ENV: "production", UPLOAD_BACKUP_DIR: value });
      expect(disabled.backup.enabled, value).toBe(false);
    }
  });
});
