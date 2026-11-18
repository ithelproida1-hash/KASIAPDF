import Link from "next/link";
import { ArrowUpRightIcon, LockIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAvailableTools, getPlannedTools } from "@/lib/pdf/tools";
import { cn } from "@/lib/utils";

export type EngineState = {
  online: boolean;
  responseTimeMs: number | null;
  version: string | null;
};

export function DashboardHero({ engine }: { engine: EngineState | null }) {
  const availableCount = getAvailableTools().length;
  const plannedCount = getPlannedTools().length;

  return (
    <section className="bg-card relative overflow-hidden rounded-2xl border">
      <div
        className="bg-grid mask-fade pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-[26rem] rounded-full opacity-25 blur-3xl"
        style={{ backgroundImage: "linear-gradient(120deg, var(--brand-from), var(--brand-to))" }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-8 p-6 sm:p-9 lg:flex-row lg:items-end lg:justify-between lg:p-11">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground bg-background/70 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur">
              <LockIcon className="size-3" aria-hidden="true" />
              Private company workspace
            </span>
            <EnginePill engine={engine} />
          </div>

          <h1 className="mt-5 font-serif text-[2.4rem] leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
            Every PDF task, <span className="brand-text-gradient italic">handled in-house</span>.
          </h1>

          <p className="text-muted-foreground mt-4 max-w-xl text-[15px] leading-relaxed text-pretty">
            Merge, split, compress and convert documents on company infrastructure. Files are
            processed on demand and never sent to third-party AI or analytics services.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Button asChild variant="brand" size="lg">
              <a href="#tools">
                Explore tools
                <ArrowUpRightIcon className="size-4" aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/admin">
                <ShieldCheckIcon className="size-4" aria-hidden="true" />
                System status
              </Link>
            </Button>
          </div>
        </div>

        <dl className="grid shrink-0 grid-cols-3 gap-3 sm:gap-4">
          <Stat value={String(availableCount)} label="Tools live" />
          <Stat value={String(plannedCount)} label="In the pipeline" />
          <Stat value="0" label="Third-party AI" />
        </dl>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-background/70 min-w-24 rounded-xl border px-3 py-3 backdrop-blur sm:px-4">
      <dt className="text-muted-foreground order-2 text-[11px] leading-tight">{label}</dt>
      <dd className="text-2xl leading-none font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

function EnginePill({ engine }: { engine: EngineState | null }) {
  if (!engine) {
    return (
      <span className="text-muted-foreground bg-background/70 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur">
        <span className="bg-warning size-1.5 rounded-full" aria-hidden="true" />
        Engine status unknown
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur",
        engine.online
          ? "border-success/25 bg-success/10 text-success"
          : "border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          engine.online ? "bg-success animate-pulse" : "bg-warning",
        )}
        aria-hidden="true"
      />
      {engine.online
        ? `Processing engine online${engine.responseTimeMs !== null ? ` · ${engine.responseTimeMs} ms` : ""}`
        : "Processing engine offline"}
    </span>
  );
}

export function PrivacyNote() {
  return (
    <div className="text-muted-foreground flex items-start gap-3 rounded-xl border border-dashed px-4 py-3.5 text-[13px]">
      <SparklesIcon className="text-primary/70 mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="text-foreground font-medium">Private by design.</span> Uploads are
        processed on the company machine and archived in a local backup folder. Document content
        is never sent to third-party AI or analytics services.
      </p>
    </div>
  );
}
