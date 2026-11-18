import { getServerConfig } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";
import { getMetrics } from "@/lib/metrics";
import { getAvailableTools, getPlannedTools } from "@/lib/pdf/tools";
import { createStirlingClient } from "@/lib/stirling/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Detailed status for the internal admin page.
 * Still secret-free: no tunnel URLs, keys or filesystem paths.
 */
export async function GET(): Promise<Response> {
  try {
    const config = getServerConfig();
    const health = await createStirlingClient(config.stirling).getHealth();

    return Response.json(
      {
        app: {
          version: config.appVersion,
          environment: config.environment,
          uptimeSeconds: Math.round(process.uptime()),
          nodeVersion: process.version,
        },
        stirling: {
          status: health.reachable ? "connected" : "disconnected",
          responseTimeMs: health.reachable ? health.responseTimeMs : null,
          version: health.version ?? null,
          latencyMs: health.responseTimeMs,
        },
        tools: {
          available: getAvailableTools().length,
          planned: getPlannedTools().length,
        },
        limits: {
          maxFileSizeMb: Math.round(config.limits.maxFileBytes / (1024 * 1024)),
          maxFilesPerJob: config.limits.maxFilesPerJob,
          maxTotalUploadMb: Math.round(config.limits.maxTotalUploadBytes / (1024 * 1024)),
          rateLimitPerMinute: config.limits.rateLimitPerMinute,
        },
        metrics: getMetrics(),
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    logger.error("Admin status failed", {
      errorCode: "config",
      message: error instanceof Error ? error.message : "unknown",
    });

    return Response.json(
      {
        app: { version: "unknown", environment: "unknown" },
        stirling: { status: "unknown", responseTimeMs: null },
        error: "Status is temporarily unavailable.",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
