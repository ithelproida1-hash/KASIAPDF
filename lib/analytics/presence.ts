/**
 * Lightweight, process-local presence tracking.
 *
 * The platform deliberately has no account system or database in Phase 1, so
 * visitor counts are kept in memory on the server instance. This is enough for
 * a self-hosted deployment: counts survive page navigation, but reset when the
 * process restarts. On a multi-instance deployment each instance keeps its own
 * counters; swap this module for Redis/Supabase before scaling horizontally.
 *
 * Privacy: only an opaque random visitor id and a timestamp are stored. No IP,
 * user agent, document content or personal data is recorded.
 */

export const PRESENCE_ONLINE_WINDOW_MS = 70_000;

export type PresenceStats = {
  /** Unique visitors seen since midnight (Asia/Kolkata). */
  dailyVisitors: number;
  /** Visitors with a heartbeat inside the online window. */
  onlineNow: number;
  /** Current tracking day as YYYY-MM-DD. */
  day: string;
};

type PresenceState = {
  day: string;
  visitors: Set<string>;
  lastSeen: Map<string, number>;
};

const GLOBAL_KEY = "__jindalKasiaPresence";

type GlobalWithPresence = typeof globalThis & {
  [GLOBAL_KEY]?: PresenceState;
};

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dayKey(now: number): string {
  const parts = dayFormatter.formatToParts(new Date(now));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function getState(now: number): PresenceState {
  const holder = globalThis as GlobalWithPresence;
  let state = holder[GLOBAL_KEY];

  if (!state) {
    state = { day: dayKey(now), visitors: new Set(), lastSeen: new Map() };
    holder[GLOBAL_KEY] = state;
  }

  if (state.day !== dayKey(now)) {
    state.day = dayKey(now);
    state.visitors.clear();
    state.lastSeen.clear();
  }

  return state;
}

function prune(state: PresenceState, now: number): void {
  for (const [visitorId, seenAt] of state.lastSeen) {
    if (now - seenAt > PRESENCE_ONLINE_WINDOW_MS) {
      state.lastSeen.delete(visitorId);
    }
  }
}

function snapshot(state: PresenceState, now: number): PresenceStats {
  prune(state, now);

  return {
    dailyVisitors: state.visitors.size,
    onlineNow: state.lastSeen.size,
    day: state.day,
  };
}

/** Records a heartbeat for a visitor and returns the refreshed counts. */
export function recordPresence(visitorId: string, now: number = Date.now()): PresenceStats {
  const state = getState(now);

  state.visitors.add(visitorId);
  state.lastSeen.set(visitorId, now);

  return snapshot(state, now);
}

/** Reads the current counts without adding a visitor. */
export function getPresenceStats(now: number = Date.now()): PresenceStats {
  return snapshot(getState(now), now);
}

/** Clears all counters. Intended for tests. */
export function resetPresence(): void {
  const holder = globalThis as GlobalWithPresence;
  delete holder[GLOBAL_KEY];
}
