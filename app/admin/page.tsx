import type { Metadata } from "next";
import Link from "next/link";
import {
  ActivityIcon,
  Clock3Icon,
  CpuIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  GaugeIcon,
  ServerIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { RefreshButton } from "@/components/admin/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerConfig } from "@/lib/config/env";
import { getMetrics } from "@/lib/metrics";
import { getToolById } from "@/lib/pdf/tools";
import { createStirlingClient } from "@/lib/stirling/client";
import { formatDateTime, formatDuration } from "@/lib/utils";

export const metadata: Metadata = {
  title: "System status",
  description: "Health and processing status of the internal PDF platform.",
};

export const dynamic = "force-dynamic";

type StatusData = {
  version: string;
  environment: string;
  engineOnline: boolean;
  engineVersion: string | null;
  engineLatencyMs: number | null;
  maxFileSizeMb: number;
  maxFiles: number;
  maxTotalMb: number;
  rateLimit: number;
  metrics: ReturnType<typeof getMetrics>;
  nodeVersion: string;
  uptimeSeconds: number;
};

async function loadStatus(): Promise<StatusData | null> {
  try {
    const config = getServerConfig();
    const health = await createStirlingClient(config.stirling).getHealth();

    return {
      version: config.appVersion,
      environment: config.environment,
      engineOnline: health.reachable,
      engineVersion: health.version ?? null,
      engineLatencyMs: health.reachable ? health.responseTimeMs : null,
      maxFileSizeMb: Math.round(config.limits.maxFileBytes / (1024 * 1024)),
      maxFiles: config.limits.maxFilesPerJob,
      maxTotalMb: Math.round(config.limits.maxTotalUploadBytes / (1024 * 1024)),
      rateLimit: config.limits.rateLimitPerMinute,
      metrics: getMetrics(),
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
    };
  } catch {
    return null;
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default async function AdminPage() {
  const status = await loadStatus();

  if (!status) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerIcon className="text-destructive size-4" aria-hidden="true" />
              Status unavailable
            </CardTitle>
            <CardDescription>
              The server configuration could not be loaded. Ask an administrator to check the
              deployment environment variables and server logs. No configuration details are shown
              here for security reasons.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { metrics } = status;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
            Operations
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">System status</h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-[13px]">
            Live health of the internal PDF pipeline. No credentials, tunnel addresses or filesystem
            paths are displayed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <RefreshButton />
          <Link
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
          >
            Health endpoint
            <ExternalLinkIcon className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ActivityIcon className="text-primary size-4" aria-hidden="true" />
                  Processing engine
                </CardTitle>
                <CardDescription>
                  Stirling-PDF, reached over the private server-side connection.
                </CardDescription>
              </div>
              <Badge variant={status.engineOnline ? "success" : "destructive"} className="mt-0.5">
                {status.engineOnline ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric
                icon={<GaugeIcon className="size-3.5" />}
                label="Response time"
                value={status.engineLatencyMs !== null ? `${status.engineLatencyMs} ms` : "—"}
              />
              <Metric
                icon={<ServerIcon className="size-3.5" />}
                label="Engine version"
                value={status.engineVersion ?? "Unknown"}
              />
              <Metric
                icon={<ShieldCheckIcon className="size-3.5" />}
                label="Authentication"
                value="Server-side only"
              />
            </dl>

            <p className="text-muted-foreground mt-5 border-t pt-4 text-[11px] leading-relaxed">
              The engine URL is read from <code className="font-mono">STIRLING_PDF_URL</code> on the
              server. It is never sent to the browser.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CpuIcon className="size-4" aria-hidden="true" />
              Application
            </CardTitle>
            <CardDescription>This Next.js deployment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Version" value={status.version} />
            <Row label="Environment" value={status.environment} />
            <Row label="Node" value={status.nodeVersion} />
            <Row label="Uptime" value={formatUptime(status.uptimeSeconds)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3Icon className="size-4" aria-hidden="true" />
              Processing activity
            </CardTitle>
            <CardDescription>Requests handled by this server instance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Total runs" value={String(metrics.totalRuns)} />
            <Row label="Successful" value={String(metrics.successfulRuns)} />
            <Row label="Failed" value={String(metrics.failedRuns)} />
            <Row
              label="Average duration"
              value={
                metrics.averageDurationMs !== null ? formatDuration(metrics.averageDurationMs) : "—"
              }
            />
            <Row label="Last success" value={formatDateTime(metrics.lastSuccessAt)} />
            <Row
              label="Last tool"
              value={
                metrics.lastTool ? (getToolById(metrics.lastTool)?.name ?? metrics.lastTool) : "—"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="size-4" aria-hidden="true" />
              Limits
            </CardTitle>
            <CardDescription>Enforced on the server for every request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Max file size" value={`${status.maxFileSizeMb} MB`} />
            <Row label="Max files per job" value={String(status.maxFiles)} />
            <Row label="Max total upload" value={`${status.maxTotalMb} MB`} />
            <Row label="Rate limit" value={`${status.rateLimit} requests / min`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4" aria-hidden="true" />
              Privacy posture
            </CardTitle>
            <CardDescription>Defaults for this deployment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Permanent storage" value="Not enabled" />
            <Row label="Uploads on disk" value="None" />
            <Row label="Third-party AI" value="Disabled" />
            <Row label="Document logging" value="Disabled" />
            <Row label="Database" value="Not configured" />
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Processing metrics are kept in memory and reset when a server instance restarts. They are
        diagnostics, not an audit trail. A persistent audit log requires Supabase or another
        database, which is intentionally not part of Phase&nbsp;1.
      </p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
