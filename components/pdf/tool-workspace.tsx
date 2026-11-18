"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, Loader2Icon, PlayIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { ToolIcon } from "@/components/pdf/tool-icon";
import { SelectedFileList } from "@/components/pdf/file-list";
import { FilePreviewDialog } from "@/components/pdf/preview-dialog";
import { ErrorPanel, ProcessingPanel, ResultPanel } from "@/components/pdf/result-panel";
import { ToolOptionsPanel, type FieldError } from "@/components/pdf/tool-options-panel";
import { UploadDropzone } from "@/components/pdf/upload-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePublicLimits } from "@/lib/api/limits";
import {
  ToolRequestError,
  downloadResult,
  runPdfTool,
  type ToolResult,
} from "@/lib/api/pdf-client";
import { inspectFile, totalSizeOf, type SelectedFile } from "@/lib/pdf/client-files";
import { getToolForm, validateToolValues, type ToolValues } from "@/lib/pdf/tool-options";
import { getCategory, getToolById } from "@/lib/pdf/tools";
import { formatBytes } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  "merge-pdf": "Merge PDFs",
  "split-pdf": "Split PDF",
  "compress-pdf": "Compress PDF",
  "rotate-pdf": "Rotate PDF",
  "jpg-to-pdf": "Create PDF",
  "pdf-to-jpg": "Convert to images",
};

type Phase = "idle" | "uploading" | "processing" | "success" | "error";

export function ToolWorkspace({ toolId }: { toolId: string }) {
  const tool = getToolById(toolId);
  const form = getToolForm(toolId);
  const limits = usePublicLimits();

  const [files, setFiles] = React.useState<SelectedFile[]>([]);
  const [values, setValues] = React.useState<ToolValues>(() => ({ ...(form?.defaults ?? {}) }));
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [uploadPercent, setUploadPercent] = React.useState(0);
  const [result, setResult] = React.useState<ToolResult | null>(null);
  const [error, setError] = React.useState<{ message: string; requestId: string | null } | null>(
    null,
  );
  const [fieldError, setFieldError] = React.useState<FieldError | null>(null);
  const [previewFile, setPreviewFile] = React.useState<File | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const busy = phase === "uploading" || phase === "processing";

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!tool || !form) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm font-medium">This tool is not available.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const category = getCategory(tool.category);
  const maxFiles = Math.min(tool.input.maxFiles, limits.maxFilesPerJob);
  const totalBytes = totalSizeOf(files);
  const meetsMinimum = files.length >= tool.input.minFiles;
  const canRun = meetsMinimum && !busy;
  const actionLabel = ACTION_LABELS[tool.id] ?? `Run ${tool.name}`;

  const openPreview = (file: File) => setPreviewFile(file);

  const addFiles = async (incoming: File[]) => {
    if (incoming.length === 0) return;

    const capacity = Math.max(0, maxFiles - files.length);

    if (capacity === 0) {
      toast.warning(`You can add up to ${maxFiles} files.`);
      return;
    }

    const queue = incoming.slice(0, capacity);
    if (incoming.length > capacity) {
      toast.warning(`Only ${capacity} more file${capacity === 1 ? "" : "s"} can be added.`);
    }

    const accepted: SelectedFile[] = [];
    let runningTotal = totalBytes;

    for (const file of queue) {
      const inspection = await inspectFile(file, tool.input, limits, runningTotal);

      if (!inspection.ok) {
        toast.error(inspection.message, { description: file.name });
        continue;
      }

      accepted.push({ id: crypto.randomUUID(), file });
      runningTotal += file.size;
    }

    if (accepted.length === 0) return;

    setFiles((previous) => (tool.input.multiple ? [...previous, ...accepted] : accepted.slice(-1)));
    setPhase("idle");
    setError(null);
    setFieldError(null);
  };

  const removeFile = (id: string) => {
    setFiles((previous) => previous.filter((entry) => entry.id !== id));
  };

  const moveFile = (id: string, direction: -1 | 1) => {
    setFiles((previous) => {
      const index = previous.findIndex((entry) => entry.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= previous.length) return previous;

      const next = [...previous];
      const current = next[index];
      const neighbour = next[target];
      if (!current || !neighbour) return previous;
      next[index] = neighbour;
      next[target] = current;
      return next;
    });
  };

  const updateValue = (name: string, value: string | number | boolean) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setFieldError((previous) => (previous?.field === name ? null : previous));
  };

  const handleRun = async () => {
    setError(null);
    setFieldError(null);

    if (!meetsMinimum) {
      toast.error(
        tool.input.minFiles > 1
          ? `Add at least ${tool.input.minFiles} files first.`
          : "Add a file first.",
      );
      return;
    }

    const validation = validateToolValues(form, values);
    if (!validation.success) {
      setFieldError({ field: validation.field, message: validation.message });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("uploading");
    setUploadPercent(0);

    try {
      const processed = await runPdfTool({
        toolId: tool.id,
        files: files.map((entry) => entry.file),
        values: validation.values,
        signal: controller.signal,
        onUploadProgress: (percent) => {
          setUploadPercent(percent);
          if (percent >= 100) setPhase("processing");
        },
      });

      setResult(processed);
      setPhase("success");
    } catch (caught) {
      if (caught instanceof ToolRequestError) {
        if (caught.code === "ABORTED") {
          setPhase("idle");
          setUploadPercent(0);
          return;
        }

        setError({ message: caught.message, requestId: caught.requestId });
        toast.error("Processing failed", { description: caught.message });
      } else {
        setError({
          message: "An unexpected error occurred. Please try again.",
          requestId: null,
        });
        toast.error("Processing failed");
      }

      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setFiles([]);
    setValues({ ...form.defaults });
    setResult(null);
    setError(null);
    setFieldError(null);
    setUploadPercent(0);
    setPhase("idle");
  };

  return (
    <div className="space-y-7">
      <div className="space-y-5">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          All tools
        </Link>

        <div className="flex items-start gap-4">
          <span className="border-primary/15 bg-primary/8 text-primary grid size-12 shrink-0 place-items-center rounded-xl border">
            <ToolIcon name={tool.icon} className="size-6" />
          </span>

          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{tool.name}</h1>
              {category ? <Badge variant="secondary">{category.label}</Badge> : null}
              <Badge variant="muted">{tool.output.label}</Badge>
            </div>
            <p className="text-muted-foreground max-w-2xl text-[13px] leading-relaxed text-pretty sm:text-sm">
              {tool.description}
            </p>
          </div>
        </div>
      </div>

      {phase === "success" && result ? (
        <ResultPanel
          result={result}
          onDownload={() => downloadResult(result)}
          onReset={handleReset}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <div className="space-y-4">
            <UploadDropzone
              accept={tool.input.accept}
              multiple={tool.input.multiple}
              disabled={busy}
              onFiles={(incoming) => void addFiles(incoming)}
              fileCount={files.length}
              limitsText={`${describeAccept(tool.input.kinds)} · up to ${limits.maxFileSizeMb} MB each · ${maxFiles} file${maxFiles === 1 ? "" : "s"} max`}
            />

            <SelectedFileList
              files={files}
              ordered={tool.input.ordered}
              onRemove={removeFile}
              onMove={moveFile}
              onPreview={openPreview}
              disabled={busy}
            />

            {files.length > 0 ? (
              <p className="text-muted-foreground text-[11px]">
                {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}
                {tool.input.ordered && files.length > 1
                  ? " · use the arrows to set the processing order"
                  : ""}
              </p>
            ) : null}

            {phase === "error" && error ? (
              <ErrorPanel
                message={error.message}
                requestId={error.requestId}
                onRetry={() => void handleRun()}
              />
            ) : null}

            {busy ? (
              <ProcessingPanel
                percent={uploadPercent}
                stage={phase === "processing" ? "processing" : "uploading"}
                onCancel={handleCancel}
              />
            ) : null}
          </div>

          <aside className="bg-card space-y-5 rounded-xl border p-5 lg:sticky lg:top-20">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Settings</h2>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                Applied by the processing engine on the server.
              </p>
            </div>

            {fieldError && !fieldError.field ? (
              <p role="alert" className="text-destructive text-xs">
                {fieldError.message}
              </p>
            ) : null}

            <ToolOptionsPanel
              fields={form.fields}
              values={values}
              onChange={updateValue}
              fieldError={fieldError}
              disabled={busy}
            />

            <Button
              type="button"
              variant="brand"
              size="lg"
              className="w-full"
              onClick={() => void handleRun()}
              disabled={!canRun}
            >
              {busy ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <PlayIcon className="size-4" aria-hidden="true" />
              )}
              {busy ? "Processing…" : actionLabel}
            </Button>

            {!meetsMinimum && files.length > 0 ? (
              <p className="text-muted-foreground text-center text-[11px]">
                Add at least {tool.input.minFiles} files to continue.
              </p>
            ) : null}

            <p className="text-muted-foreground flex items-start gap-1.5 border-t pt-4 text-[11px] leading-relaxed">
              <ShieldCheckIcon
                className="text-success mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Files are held in memory for this request only and are never written to permanent
              storage.
            </p>
          </aside>
        </div>
      )}

      <FilePreviewDialog
        file={previewFile}
        open={previewFile !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
      />
    </div>
  );
}

function describeAccept(kinds: readonly string[]): string {
  const labels: Record<string, string> = {
    pdf: "PDF",
    jpeg: "JPG",
    png: "PNG",
    webp: "WebP",
    gif: "GIF",
  };

  const values = kinds.map((kind) => labels[kind] ?? kind.toUpperCase());
  return values.length > 0 ? values.join(", ") : "Supported files";
}
