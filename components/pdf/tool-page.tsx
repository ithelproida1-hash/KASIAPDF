import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { ToolIcon } from "@/components/pdf/tool-icon";
import { ToolWorkspace } from "@/components/pdf/tool-workspace";
import { getRelatedTools, getToolById } from "@/lib/pdf/tools";

export function ToolPage({ toolId }: { toolId: string }) {
  const tool = getToolById(toolId);

  if (!tool || tool.status !== "available") {
    notFound();
  }

  const related = getRelatedTools(tool);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <ToolWorkspace toolId={tool.id} />

      {related.length > 0 ? (
        <section className="mt-12 border-t pt-6" aria-labelledby="related-tools">
          <h2 id="related-tools" className="text-sm font-semibold tracking-tight">
            Related tools
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/${item.slug}`}
                className="group bg-card hover:border-primary/30 focus-visible:ring-ring flex items-center gap-3 rounded-lg border p-3 transition-colors outline-none focus-visible:ring-2"
              >
                <span className="bg-muted/60 text-muted-foreground group-hover:text-primary grid size-8 shrink-0 place-items-center rounded-md transition-colors">
                  <ToolIcon name={item.icon} className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.name}</span>
                <ArrowRightIcon className="text-muted-foreground/50 size-3.5" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
