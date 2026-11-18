/**
 * Structured server-side logging.
 *
 * Never log document contents, document text, filenames, signed URLs,
 * API keys or environment values. Only operational metadata.
 */

type LogLevel = "info" | "warn" | "error";

export type LogFields = {
  requestId?: string;
  jobId?: string;
  tool?: string;
  operation?: string;
  durationMs?: number;
  status?: number;
  errorCode?: string;
  fileCount?: number;
  totalBytes?: number;
  environment?: string;
  [key: string]: string | number | boolean | undefined;
};

const REDACTED_KEYS = [
  "authorization",
  "apikey",
  "api_key",
  "key",
  "secret",
  "password",
  "token",
  "url",
  "path",
  "filename",
];

function sanitize(fields: LogFields): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    const lowerKey = key.toLowerCase();
    if (REDACTED_KEYS.some((redacted) => lowerKey.includes(redacted))) {
      continue;
    }

    if (typeof value === "string" && value.length > 500) {
      safe[key] = `${value.slice(0, 500)}…`;
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

function write(level: LogLevel, message: string, fields: LogFields): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...sanitize(fields),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  info(message: string, fields: LogFields = {}) {
    write("info", message, fields);
  },
  warn(message: string, fields: LogFields = {}) {
    write("warn", message, fields);
  },
  error(message: string, fields: LogFields = {}) {
    write("error", message, fields);
  },
};
