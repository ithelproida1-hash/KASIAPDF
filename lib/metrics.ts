/**
 * Process-local operational metrics for the admin status page.
 * Serverless instances do not share this state; it is a convenience for
 * diagnostics, not an audit trail.
 */

export type MetricsSnapshot = {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastTool: string | null;
  averageDurationMs: number | null;
};

type MetricsState = Omit<MetricsSnapshot, "averageDurationMs"> & {
  totalDurationMs: number;
  completedRuns: number;
};

const state: MetricsState = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastTool: null,
  totalDurationMs: 0,
  completedRuns: 0,
};

export function recordToolRun(input: { tool: string; success: boolean; durationMs: number }): void {
  state.totalRuns += 1;
  state.lastTool = input.tool;
  state.totalDurationMs += input.durationMs;
  state.completedRuns += 1;

  if (input.success) {
    state.successfulRuns += 1;
    state.lastSuccessAt = new Date().toISOString();
  } else {
    state.failedRuns += 1;
    state.lastFailureAt = new Date().toISOString();
  }
}

export function getMetrics(): MetricsSnapshot {
  return {
    totalRuns: state.totalRuns,
    successfulRuns: state.successfulRuns,
    failedRuns: state.failedRuns,
    lastSuccessAt: state.lastSuccessAt,
    lastFailureAt: state.lastFailureAt,
    lastTool: state.lastTool,
    averageDurationMs:
      state.completedRuns > 0 ? Math.round(state.totalDurationMs / state.completedRuns) : null,
  };
}

export function resetMetrics(): void {
  state.totalRuns = 0;
  state.successfulRuns = 0;
  state.failedRuns = 0;
  state.lastSuccessAt = null;
  state.lastFailureAt = null;
  state.lastTool = null;
  state.totalDurationMs = 0;
  state.completedRuns = 0;
}
