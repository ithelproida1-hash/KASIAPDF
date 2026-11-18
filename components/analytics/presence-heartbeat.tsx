"use client";

import * as React from "react";

import { getVisitorId } from "@/lib/analytics/visitor-id";

const HEARTBEAT_MS = 20_000;

/**
 * Sends an anonymous presence heartbeat from every page so the dashboard's
 * "online now" count also includes people working inside a tool.
 */
export function PresenceHeartbeat() {
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const visitorId = getVisitorId();

    const beat = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        await fetch("/api/presence", {
          cache: "no-store",
          keepalive: true,
          headers: visitorId ? { "x-visitor-id": visitorId } : undefined,
        });
      } catch {
        // Presence is best-effort; a missed beat simply expires the session.
      }
    };

    const start = () => {
      if (timer) clearInterval(timer);
      timer = undefined;

      if (document.visibilityState === "hidden") return;

      void beat();
      timer = setInterval(beat, HEARTBEAT_MS);
    };

    start();
    document.addEventListener("visibilitychange", start);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  return null;
}
