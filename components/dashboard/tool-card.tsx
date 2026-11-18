import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { ToolIcon } from "@/components/pdf/tool-icon";
import { Badge } from "@/components/ui/badge";
import type { PdfTool } from "@/lib/pdf/tools";
import { cn } from "@/lib/utils";

export function ToolCard({ tool }: { tool: PdfTool }) {
  const available = tool.status === "available";

  const body = (
    <div
      className={cn(
        "group bg-card relative flex h-full flex-col gap-3 rounded-xl border p-5 transition-[transform,box-shadow,border-color] duration-200",
        available
          ? "hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-18px_oklch(0.4_0.15_270/0.45)]"
          : "bg-card/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-lg border",
            available
              ? "border-primary/15 bg-primary/8 text-primary"
              : "bg-muted text-muted-foreground/70",
          )}
        >
          <ToolIcon name={tool.icon} />
        </span>

        {available ? (
          <ArrowRightIcon
            className="text-muted-foreground/50 group-hover:text-primary size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        ) : (
          <Badge variant="muted" className="text-[10px]">
            Planned
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold tracking-tight">{tool.name}</h3>
        <p className="text-muted-foreground text-[13px] leading-relaxed">{tool.summary}</p>
      </div>

      <p className="text-muted-foreground/70 mt-auto text-[11px]">{tool.output.label}</p>
    </div>
  );

  if (!available) {
    return (
      <div aria-disabled="true" className="h-full opacity-70">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/${tool.slug}`}
      className="focus-visible:ring-ring focus-visible:ring-offset-background block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {body}
    </Link>
  );
}
