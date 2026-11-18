"use client";

import * as React from "react";

export type PublicLimits = {
  maxFileSizeMb: number;
  maxFilesPerJob: number;
  maxTotalUploadMb: number;
};

const DEFAULT_LIMITS: PublicLimits = {
  maxFileSizeMb: 100,
  maxFilesPerJob: 10,
  maxTotalUploadMb: 250,
};

let cached: Promise<PublicLimits> | null = null;

function loadLimits(): Promise<PublicLimits> {
  cached ??= fetch("/api/health", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok && response.status !== 503) {
        return DEFAULT_LIMITS;
      }

      const payload = (await response.json()) as { limits?: Partial<PublicLimits> };
      return {
        maxFileSizeMb: payload.limits?.maxFileSizeMb ?? DEFAULT_LIMITS.maxFileSizeMb,
        maxFilesPerJob: payload.limits?.maxFilesPerJob ?? DEFAULT_LIMITS.maxFilesPerJob,
        maxTotalUploadMb: payload.limits?.maxTotalUploadMb ?? DEFAULT_LIMITS.maxTotalUploadMb,
      };
    })
    .catch(() => DEFAULT_LIMITS);

  return cached;
}

/** Loads server-enforced limits once per browser session. */
export function usePublicLimits(): PublicLimits {
  const [limits, setLimits] = React.useState<PublicLimits>(DEFAULT_LIMITS);

  React.useEffect(() => {
    let cancelled = false;

    void loadLimits().then((value) => {
      if (!cancelled) setLimits(value);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return limits;
}
