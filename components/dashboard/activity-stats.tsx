"use client";

import * as React from "react";
import { ActivityIcon, UsersIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const REFRESH_MS = 20_000;

type PresenceResponse = {
  dailyVisitors: number;
  onlineNow: number;
};

type Status = "loading" | "ready" | "error";

/**
 * Live daily-visitor and online-user counts for the dashboard.
 *
 * The counts come from the server's presence store, refreshed every 20 seconds
 * while the tab is visible. The heartbeat itself is sent globally by
 * `PresenceHeartbeat`, so browsing a tool page keeps the visitor online.
 */
export function ActivityStats() {
  const [stats, setStats] = React.useState<PresenceResponse | null>(null);
  const [status, setStatus] = React.useState<Status>("loading");

  React.useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    const load = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        const response = await fetch("/api/presence?peek=1", { cache: "no-store" });
        if (!response.ok) throw new Error(`Presence request failed: ${response.status}`);

        const data = (await response.json()) as PresenceResponse;
        if (!active) return;

        setStats({ dailyVisitors: data.dailyVisitors, onlineNow: data.onlineNow });
        setStatus("ready");
      } catch {
        if (active) setStatus((current) => (current === "ready" ? "ready" : "error"));
      }
    };

    const startPolling = () => {
      if (timer) clearInterval(timer);
      timer = undefined;

      if (document.visibilityState === "hidden") return;

      void load();
      timer = setInterval(load, REFRESH_MS);
    };

    startPolling();
    document.addEventListener("visibilitychange", startPolling);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", startPolling);
    };
  }, []);

  const live = status === "ready";

  return (
    <Card className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-20 -right-12 size-44 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden="true"
      />
      <CardHeader className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="text-primary size-4" aria-hidden="true" />
              Workspace activity
            </CardTitle>
            <CardDescription className="mt-1">
              Live usage on this server. Only an anonymous visit id is counted.
            </CardDescription>
          </div>
          <span className="text-muted-foreground bg-background/70 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium">
            <span className="relative flex size-1.5" aria-hidden="true">
              {live ? (
                <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-75" />
              ) : null}
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full",
                  status === "ready" && "bg-success",
                  status === "loading" && "bg-muted-foreground animate-pulse",
                  status === "error" && "bg-warning",
                )}
              />
            </span>
            {status === "error" ? "Reconnecting" : "Live"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <dl className="grid grid-cols-2 gap-3">
          <Metric
            label="Visitors today"
            value={stats?.dailyVisitors}
            icon={<UsersIcon className="size-3" aria-hidden="true" />}
            testId="daily-visitors"
          />
          <Metric
            label="Online now"
            value={stats?.onlineNow}
            icon={<ActivityIcon className="size-3" aria-hidden="true" />}
            testId="online-users"
          />
        </dl>
        <p className="text-muted-foreground mt-3 text-[11px]">
          The daily count resets at midnight IST. Online users are visitors active in the last 70
          seconds.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  icon,
  testId,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  testId: string;
}) {
  return (
    <div className="bg-background/70 rounded-xl border px-3 py-3 backdrop-blur sm:px-4">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-[11px] leading-tight">
        {icon}
        {label}
      </dt>
      <dd
        data-testid={testId}
        className="mt-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums"
      >
        {value === undefined ? "—" : value.toLocaleString("en-IN")}
      </dd>
    </div>
  );
}
