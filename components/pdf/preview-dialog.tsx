"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function FilePreviewDialog({
  file,
  open,
  onOpenChange,
}: {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const url = React.useMemo(() => (open && file ? URL.createObjectURL(file) : null), [file, open]);

  React.useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{file?.name ?? "Preview"}</DialogTitle>
          <DialogDescription>
            Rendered locally in your browser. Nothing is uploaded for this preview.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/40 grid max-h-[70vh] min-h-64 place-items-center overflow-auto rounded-lg border">
          {!url ? (
            <p className="text-muted-foreground p-6 text-sm">Preparing preview…</p>
          ) : file && isPdfFile(file) ? (
            <iframe
              src={url}
              title={`Preview of ${file.name}`}
              className="h-[65vh] w-full rounded-lg"
            />
          ) : file ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL preview of a local file
            <img
              src={url}
              alt={`Preview of ${file.name}`}
              className="max-h-[65vh] w-auto object-contain"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
