"use client";

import * as React from "react";
import { CloudUploadIcon, FilePlus2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UploadDropzone({
  accept,
  multiple,
  disabled,
  onFiles,
  fileCount,
  limitsText,
  capture,
}: {
  accept: string;
  multiple: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  fileCount: number;
  limitsText: string;
  /** Hint mobile browsers to open the camera directly. */
  capture?: "user" | "environment";
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const dragDepth = React.useRef(0);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    onFiles(Array.from(fileList));
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border bg-card/50",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <span
        className={cn(
          "grid size-12 place-items-center rounded-xl border transition-colors",
          dragging
            ? "border-primary/30 bg-primary/10 text-primary"
            : "bg-muted/60 text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {fileCount > 0 ? (
          <FilePlus2Icon className="size-5" />
        ) : (
          <CloudUploadIcon className="size-5" />
        )}
      </span>

      <div className="space-y-1">
        <p className="text-sm font-medium">
          {fileCount > 0
            ? multiple
              ? "Drop more files, or add them manually"
              : "Replace the selected file"
            : "Drag files here to upload"}
        </p>
        <p className="text-muted-foreground text-xs">{limitsText}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        capture={capture}
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
        tabIndex={-1}
      />

      <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={disabled}>
        Choose {multiple ? "files" : "a file"}
      </Button>

      <p className="text-muted-foreground/70 text-[11px]">
        The picker is the keyboard alternative to drag and drop.
      </p>
    </div>
  );
}
