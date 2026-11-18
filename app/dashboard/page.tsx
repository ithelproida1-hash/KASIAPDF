import { DashboardHero, PrivacyNote, type EngineState } from "@/components/dashboard/hero";
import { ToolExplorer } from "@/components/dashboard/tool-explorer";
import { getServerConfig } from "@/lib/config/env";
import { createStirlingClient } from "@/lib/stirling/client";

export const dynamic = "force-dynamic";

async function getEngineState(): Promise<EngineState | null> {
  try {
    const config = getServerConfig();
    const health = await createStirlingClient(config.stirling).getHealth();

    return {
      online: health.reachable,
      responseTimeMs: health.reachable ? health.responseTimeMs : null,
      version: health.version ?? null,
    };
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const engine = await getEngineState();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <DashboardHero engine={engine} />
      <ToolExplorer />
      <PrivacyNote />
    </div>
  );
}
