"use client";

import * as React from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { ToolCard } from "@/components/dashboard/tool-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES, TOOLS, type PdfCategoryId } from "@/lib/pdf/tools";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | PdfCategoryId;

export function ToolExplorer() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<CategoryFilter>("all");

  const normalisedQuery = query.trim().toLowerCase();

  const filteredTools = React.useMemo(() => {
    return TOOLS.filter((tool) => {
      const matchesCategory = category === "all" || tool.category === category;
      const matchesQuery =
        normalisedQuery.length === 0 ||
        tool.name.toLowerCase().includes(normalisedQuery) ||
        tool.summary.toLowerCase().includes(normalisedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, normalisedQuery]);

  const groups = React.useMemo(() => {
    return CATEGORIES.map((categoryMeta) => ({
      ...categoryMeta,
      tools: filteredTools.filter((tool) => tool.category === categoryMeta.id),
    })).filter((group) => group.tools.length > 0);
  }, [filteredTools]);

  const categoriesWithTools = React.useMemo(() => {
    return CATEGORIES.filter((meta) => TOOLS.some((tool) => tool.category === meta.id));
  }, []);

  return (
    <section id="tools" className="scroll-mt-20 space-y-7">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Tool library</h2>
            <p className="text-muted-foreground mt-1 text-[13px]">
              {filteredTools.length} {filteredTools.length === 1 ? "tool" : "tools"} shown ·
              available tools open instantly
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools…"
              aria-label="Search tools"
              className="h-9 pl-9"
            />
            {query ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <XIcon className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>

        <div
          className="-mx-1 flex flex-wrap gap-1.5 px-1"
          role="group"
          aria-label="Filter by category"
        >
          <FilterChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All"
            count={TOOLS.length}
          />
          {categoriesWithTools.map((meta) => (
            <FilterChip
              key={meta.id}
              active={category === meta.id}
              onClick={() => setCategory(meta.id)}
              label={meta.label}
              count={TOOLS.filter((tool) => tool.category === meta.id).length}
            />
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="font-medium">No tools match “{query}”</p>
          <p className="text-muted-foreground text-sm">
            Try a different search term or clear the category filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <div key={group.id} id={`category-${group.id}`} className="scroll-mt-20">
              <div className="mb-3.5 flex items-baseline gap-2.5">
                <h3 className="text-sm font-semibold tracking-tight">{group.label}</h3>
                <span className="text-muted-foreground/60 text-[11px]">{group.description}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-visible:ring-ring inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
      )}
    >
      {label}
      <span className={cn("text-[10px]", active ? "text-primary/70" : "text-muted-foreground/60")}>
        {count}
      </span>
    </button>
  );
}
