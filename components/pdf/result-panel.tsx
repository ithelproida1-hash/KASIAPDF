"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  Loader2Icon,
  RotateCcwIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ToolResult } from "@/lib/api/pdf-client";
import { formatBytes } from "@/lib/utils";

/** Upload + processing state. */
export function ProcessingPanel({
  percent,
  stage,
  onCancel,
}: {
  percent: number;
  stage: "uploading" | "processing";
  onCancel: () => void;
}) {
  return (
    <div className="bg-card space-y-4 rounded-xl border p-5">
      <div className="flex items-center gap-2.5">
        <Loader2Icon className="text-primary size-4 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium" role="status" aria-live="polite">
          {stage === "uploading" ? "Uploading files…" : "Processing on the company server…"}
        </p>
        <span className="text-muted-foreground ml-auto font-mono text-xs tabular-nums">
          {stage === "uploading" ? `${percent}%` : "Working"}
        </span>
      </div>

      <Progress
        value={stage === "uploading" ? percent : 100}
        aria-label={stage === "uploading" ? "Upload progress" : "Processing"}
        className={stage === "processing" ? "animate-pulse" : undefined}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-[11px]">
          Keep this tab open. Large documents can take a little longer.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Error state with a clear retry path. */
export function ErrorPanel({
  message,
  requestId,
  onRetry,
}: {
  message: string;
  requestId: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive/5 space-y-3 rounded-xl border p-5"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangleIcon className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium">The file could not be processed</p>
          <p className="text-muted-foreground text-[13px] leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RotateCcwIcon className="size-3.5" />
          Try again
        </Button>
        {requestId ? (
          <p className="text-muted-foreground/70 font-mono text-[10px]">Reference {requestId}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Success state: download or start over. */
export function ResultPanel({
  result,
  onDownload,
  onReset,
}: {
  result: ToolResult;
  onDownload: () => void;
  onReset: () => void;
}) {
  return (
    <div className="bg-card shadow-soft overflow-hidden rounded-2xl border">
      <div className="brand-gradient h-1 w-full" aria-hidden="true" />
      <div className="space-y-5 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="bg-success/12 text-success grid size-11 shrink-0 place-items-center rounded-xl">
            <CheckCircle2Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Your file is ready</h2>
            <p className="text-muted-foreground text-[13px]">
              Processed on company infrastructure. The temporary copy has already been released.
            </p>
          </div>
        </div>

        <div className="bg-muted/40 flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium" title={result.filename}>
              {result.filename}
            </p>
            <p className="text-muted-foreground text-[11px]">{formatBytes(result.blob.size)}</p>
          </div>
          {result.requestId ? (
            <p className="text-muted-foreground/60 hidden shrink-0 font-mono text-[10px] sm:block">
              {result.requestId.slice(0, 8)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="brand" onClick={onDownload} autoFocus>
            <DownloadIcon className="size-4" />
            Download
          </Button>
          <Button type="button" variant="outline" onClick={onReset}>
            <RotateCcwIcon className="size-4" />
            Start over
          </Button>
        </div>
      </div>
    </div>
  );
}
