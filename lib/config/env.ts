import packageJson from "@/package.json";

import { z } from "zod";

/**
 * Server-side configuration.
 *
 * This module must never be imported by a Client Component. It reads secrets
 * from process.env and therefore stays on the server (route handlers, server
 * components, tests).
 */

const DEFAULT_APP_NAME = "Jindal Kasia PDF";

const numeric = (options: { min: number; max: number; fallback: number }) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === "") {
        return options.fallback;
      }
      return Number(value);
    })
    .refine((value) => Number.isFinite(value), { message: "must be a number" })
    .refine((value) => value >= options.min && value <= options.max, {
      message: `must be between ${options.min} and ${options.max}`,
    });

const envSchema = z
  .object({
    STIRLING_PDF_URL: z.string().trim().optional(),
    STIRLING_PDF_API_KEY: z.string().optional(),
    STIRLING_TIMEOUT_MS: numeric({ min: 1_000, max: 600_000, fallback: 120_000 }),
    STIRLING_HEALTH_TIMEOUT_MS: numeric({ min: 500, max: 30_000, fallback: 4_000 }),
    MAX_FILE_SIZE_MB: numeric({ min: 1, max: 2_048, fallback: 100 }),
    MAX_FILES_PER_JOB: numeric({ min: 1, max: 100, fallback: 10 }),
    MAX_TOTAL_UPLOAD_MB: numeric({ min: 1, max: 4_096, fallback: 250 }),
    RATE_LIMIT_PER_MINUTE: numeric({ min: 1, max: 1_000, fallback: 30 }),
    UPLOAD_BACKUP_DIR: z.string().optional(),
    URL_ALLOWLIST: z.string().optional(),
    CLOUDFLARE_ACCESS_CLIENT_ID: z.string().trim().optional(),
    CLOUDFLARE_ACCESS_CLIENT_SECRET: z.string().trim().optional(),
    VERCEL_ENV: z.string().optional(),
    NODE_ENV: z.string().optional(),
  })
  .refine((env) => env.MAX_TOTAL_UPLOAD_MB >= env.MAX_FILE_SIZE_MB, {
    message: "MAX_TOTAL_UPLOAD_MB must be greater than or equal to MAX_FILE_SIZE_MB",
    path: ["MAX_TOTAL_UPLOAD_MB"],
  })
  .refine(
    (env) =>
      Boolean(env.CLOUDFLARE_ACCESS_CLIENT_ID) === Boolean(env.CLOUDFLARE_ACCESS_CLIENT_SECRET),
    {
      message:
        "CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET must be set together",
      path: ["CLOUDFLARE_ACCESS_CLIENT_SECRET"],
    },
  );

export type ServerConfig = {
  appName: string;
  appVersion: string;
  environment: "development" | "preview" | "production" | "test";
  stirling: {
    baseUrl: string;
    apiKey?: string;
    timeoutMs: number;
    healthTimeoutMs: number;
    /** Cloudflare Access service token, when the tunnel is protected by Access. */
    access?: {
      clientId: string;
      clientSecret: string;
    };
  };
  limits: {
    maxFileBytes: number;
    maxFilesPerJob: number;
    maxTotalUploadBytes: number;
    rateLimitPerMinute: number;
  };
  security: {
    urlAllowlist: string[];
  };
  backup: {
    enabled: boolean;
    /** Absolute or working-directory-relative folder for archived uploads. */
    directory: string | null;
  };
};

export type EnvSource = Record<string, string | undefined>;

const MB = 1024 * 1024;

function parseUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("STIRLING_PDF_URL must be a valid absolute URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("STIRLING_PDF_URL must use http or https");
  }

  if (parsed.username || parsed.password) {
    throw new Error("STIRLING_PDF_URL must not contain credentials");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function resolveEnvironment(env: EnvSource): ServerConfig["environment"] {
  if (env.NODE_ENV === "test") return "test";
  if (env.VERCEL_ENV === "preview") return "preview";
  if (env.VERCEL_ENV === "production") return "production";
  if (env.NODE_ENV === "production") return "production";
  return "development";
}

/**
 * Pure parser used by `getServerConfig` and by tests.
 * Throws an Error that names the offending variable but never echoes values.
 */
export function parseServerConfig(env: EnvSource): ServerConfig {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "env"))];
    throw new Error(`Invalid server environment configuration: ${keys.join(", ")}`);
  }

  const parsed = result.data;
  const baseUrl = parseUrl(parsed.STIRLING_PDF_URL?.trim() || "http://localhost:8080");
  const apiKey = parsed.STIRLING_PDF_API_KEY?.trim();
  const accessClientId = parsed.CLOUDFLARE_ACCESS_CLIENT_ID;
  const accessClientSecret = parsed.CLOUDFLARE_ACCESS_CLIENT_SECRET;

  // Uploads are archived locally by default. An explicit empty value or
  // "off"/"false"/"none" disables the backup (useful for tests and ephemeral
  // deployments).
  const rawBackup = parsed.UPLOAD_BACKUP_DIR?.trim();
  const backupDisabled =
    rawBackup !== undefined && ["", "off", "false", "none"].includes(rawBackup.toLowerCase());
  const backupDirectory =
    backupDisabled || (rawBackup === undefined && parsed.NODE_ENV === "test")
      ? null
      : rawBackup || "storage/uploads";

  return {
    appName: env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_APP_NAME,
    appVersion: packageJson.version,
    environment: resolveEnvironment(env),
    stirling: {
      baseUrl,
      apiKey: apiKey ? apiKey : undefined,
      timeoutMs: parsed.STIRLING_TIMEOUT_MS,
      healthTimeoutMs: parsed.STIRLING_HEALTH_TIMEOUT_MS,
      ...(accessClientId && accessClientSecret
        ? { access: { clientId: accessClientId, clientSecret: accessClientSecret } }
        : {}),
    },
    limits: {
      maxFileBytes: Math.round(parsed.MAX_FILE_SIZE_MB * MB),
      maxFilesPerJob: Math.floor(parsed.MAX_FILES_PER_JOB),
      maxTotalUploadBytes: Math.round(parsed.MAX_TOTAL_UPLOAD_MB * MB),
      rateLimitPerMinute: Math.floor(parsed.RATE_LIMIT_PER_MINUTE),
    },
    security: {
      urlAllowlist: (parsed.URL_ALLOWLIST ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    },
    backup: {
      enabled: backupDirectory !== null,
      directory: backupDirectory,
    },
  };
}

let cached: ServerConfig | null = null;

export function getServerConfig(): ServerConfig {
  if (typeof window !== "undefined") {
    throw new Error("getServerConfig() must not be called from the browser");
  }

  if (!cached) {
    cached = parseServerConfig(process.env);
  }

  return cached;
}

/** Clears the cached config. Intended for tests. */
export function resetServerConfigCache(): void {
  cached = null;
}

/** Safe, public values only. */
export function getPublicConfig() {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_APP_NAME,
    appVersion: packageJson.version,
  };
}
