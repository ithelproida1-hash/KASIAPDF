import { beforeEach, describe, expect, it } from "vitest";

import {
  PRESENCE_ONLINE_WINDOW_MS,
  getPresenceStats,
  recordPresence,
  resetPresence,
} from "@/lib/analytics/presence";

const MORNING_IST = new Date("2026-11-18T10:00:00+05:30").getTime();

describe("presence tracking", () => {
  beforeEach(() => {
    resetPresence();
  });

  it("counts unique visitors and active users separately", () => {
    expect(getPresenceStats(MORNING_IST)).toEqual({
      dailyVisitors: 0,
      onlineNow: 0,
      day: "2026-11-18",
    });

    recordPresence("visitor-a", MORNING_IST);
    recordPresence("visitor-b", MORNING_IST + 1_000);
    recordPresence("visitor-a", MORNING_IST + 2_000);

    const stats = getPresenceStats(MORNING_IST + 3_000);
    expect(stats.dailyVisitors).toBe(2);
    expect(stats.onlineNow).toBe(2);
  });

  it("drops users after the online window but keeps the daily count", () => {
    recordPresence("visitor-a", MORNING_IST);

    const later = MORNING_IST + PRESENCE_ONLINE_WINDOW_MS + 1_000;
    const stats = getPresenceStats(later);

    expect(stats.onlineNow).toBe(0);
    expect(stats.dailyVisitors).toBe(1);
  });

  it("resets the daily count at midnight IST", () => {
    const beforeMidnight = new Date("2026-11-18T23:59:00+05:30").getTime();
    const afterMidnight = new Date("2026-11-19T00:01:00+05:30").getTime();

    recordPresence("visitor-a", beforeMidnight);
    expect(getPresenceStats(beforeMidnight)).toMatchObject({
      dailyVisitors: 1,
      day: "2026-11-18",
    });

    recordPresence("visitor-b", afterMidnight);
    expect(getPresenceStats(afterMidnight)).toMatchObject({
      dailyVisitors: 1,
      day: "2026-11-19",
    });
  });
});
