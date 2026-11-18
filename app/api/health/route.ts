import { getServerConfig } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";
import { createStirlingClient } from "@/lib/stirling/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public health endpoint.
 * Reports coarse status only: no URLs, keys, paths or version internals.
 */
export async function GET(): Promise<Response> {
  let status: "ok" | "degraded" = "degraded";
  let version = "unknown";
  let environment = "unknown";
  let stirling: "healthy" | "unreachable" = "unreachable";
  let responseTimeMs: number | null = null;
  let limits = { maxFileSizeMb: 100, maxFilesPerJob: 10, maxTotalUploadMb: 250 };

  try {
    const config = getServerConfig();
    version = config.appVersion;
    environment = config.environment;
    limits = {
      maxFileSizeMb: Math.round(config.limits.maxFileBytes / (1024 * 1024)),
      maxFilesPerJob: config.limits.maxFilesPerJob,
      maxTotalUploadMb: Math.round(config.limits.maxTotalUploadBytes / (1024 * 1024)),
    };

    const health = await createStirlingClient(config.stirling).getHealth();
    responseTimeMs = health.responseTimeMs;
    stirling = health.reachable ? "healthy" : "unreachable";
    status = health.reachable ? "ok" : "degraded";

    if (!health.reachable) {
      logger.warn("Health check: Stirling unreachable", {
        environment,
        errorCode: health.error ?? "unknown",
      });
    }
  } catch (error) {
    logger.error("Health check failed", {
      errorCode: "config",
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  const body = {
    status,
    services: {
      app: "healthy",
      stirling,
      database: "not_configured",
    },
    version,
    environment,
    responseTimeMs,
    limits,
    timestamp: new Date().toISOString(),
  };

  return Response.json(body, {
    status: status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
