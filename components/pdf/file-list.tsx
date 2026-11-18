"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  FileTextIcon,
  ImageIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SelectedFile } from "@/lib/pdf/client-files";
import { formatBytes } from "@/lib/utils";

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

export function SelectedFileList({
  files,
  ordered,
  onRemove,
  onMove,
  onPreview,
  disabled,
}: {
  files: SelectedFile[];
  ordered: boolean;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onPreview: (file: File) => void;
  disabled?: boolean;
}) {
  if (files.length === 0) return null;

  return (
    <ul className="space-y-2" aria-label="Selected files">
      {files.map((entry, index) => {
        const canReorder = ordered && files.length > 1;

        return (
          <li
            key={entry.id}
            className="bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5"
          >
            <span className="text-muted-foreground/70 bg-muted/60 grid size-8 shrink-0 place-items-center rounded-md">
              {isImageFile(entry.file) ? (
                <ImageIcon className="size-4" aria-hidden="true" />
              ) : (
                <FileTextIcon className="size-4" aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium" title={entry.file.name}>
                {entry.file.name}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {formatBytes(entry.file.size)}
                {canReorder ? ` · Position ${index + 1}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-0.5">
              <IconAction
                label={`Preview ${entry.file.name}`}
                onClick={() => onPreview(entry.file)}
                disabled={disabled}
              >
                <EyeIcon className="size-4" />
              </IconAction>

              {canReorder ? (
                <>
                  <IconAction
                    label={`Move ${entry.file.name} up`}
                    onClick={() => onMove(entry.id, -1)}
                    disabled={disabled || index === 0}
                  >
                    <ArrowUpIcon className="size-4" />
                  </IconAction>
                  <IconAction
                    label={`Move ${entry.file.name} down`}
                    onClick={() => onMove(entry.id, 1)}
                    disabled={disabled || index === files.length - 1}
                  >
                    <ArrowDownIcon className="size-4" />
                  </IconAction>
                </>
              ) : null}

              <IconAction
                label={`Remove ${entry.file.name}`}
                onClick={() => onRemove(entry.id)}
                disabled={disabled}
                destructive
              >
                <Trash2Icon className="size-4" />
              </IconAction>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={destructive ? "hover:text-destructive" : undefined}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
