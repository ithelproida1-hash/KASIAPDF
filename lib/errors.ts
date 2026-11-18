/**
 * Central error taxonomy shared by the API layer, Stirling client and UI.
 *
 * Rules:
 * - `message` is for developers and server logs.
 * - `userMessage` is safe to render in the browser: no URLs, paths or secrets.
 */

export type ErrorCode =
  | "INVALID_INPUT"
  | "INVALID_PDF"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "RATE_LIMITED"
  | "STIRLING_UNAVAILABLE"
  | "STIRLING_TIMEOUT"
  | "STIRLING_UNAUTHORIZED"
  | "STIRLING_REJECTED"
  | "PROCESSING_FAILED"
  | "TOOL_NOT_AVAILABLE"
  | "UNKNOWN";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  INVALID_PDF: 422,
  UNSUPPORTED_FILE_TYPE: 415,
  FILE_TOO_LARGE: 413,
  TOO_MANY_FILES: 400,
  RATE_LIMITED: 429,
  STIRLING_UNAVAILABLE: 503,
  STIRLING_TIMEOUT: 504,
  STIRLING_UNAUTHORIZED: 502,
  STIRLING_REJECTED: 422,
  PROCESSING_FAILED: 500,
  TOOL_NOT_AVAILABLE: 404,
  UNKNOWN: 500,
};

const USER_MESSAGE_BY_CODE: Record<ErrorCode, string> = {
  INVALID_INPUT:
    "Some of the settings or files provided are not valid. Please review and try again.",
  INVALID_PDF:
    "This file could not be read. It may be corrupted, password-protected, or not a real PDF.",
  UNSUPPORTED_FILE_TYPE: "That file type is not supported by this tool.",
  FILE_TOO_LARGE: "The file is larger than the allowed upload limit.",
  TOO_MANY_FILES: "Too many files were selected for this tool.",
  RATE_LIMITED: "Too many requests in a short period. Please wait a moment and try again.",
  STIRLING_UNAVAILABLE:
    "The PDF processing service is not reachable right now. Please try again in a moment.",
  STIRLING_TIMEOUT:
    "The PDF processing service took too long to respond. Try a smaller file or try again.",
  STIRLING_UNAUTHORIZED:
    "The PDF processing service rejected our credentials. Please contact an administrator.",
  STIRLING_REJECTED: "The PDF processing service could not complete this operation.",
  PROCESSING_FAILED: "Something went wrong while processing the file. Please try again.",
  TOOL_NOT_AVAILABLE: "This tool is not available yet.",
  UNKNOWN: "An unexpected error occurred. Please try again.",
};

export type AppErrorOptions = {
  retryable?: boolean;
  /** Specific, safe guidance shown instead of the default message. */
  userMessage?: string;
  /** Technical context for server logs only. Never sent to the browser. */
  details?: Record<string, unknown>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, options: AppErrorOptions = {}) {
    super(message ?? code, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.userMessage = options.userMessage ?? USER_MESSAGE_BY_CODE[code];
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Coerces an unknown thrown value into an AppError without leaking internals. */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) {
    return value;
  }

  return new AppError("UNKNOWN", "Unexpected error", { cause: value });
}

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    retryable: boolean;
  };
};

export function apiErrorBody(error: AppError, requestId: string): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.userMessage,
      requestId,
      retryable: error.retryable,
    },
  };
}

export function errorStatus(error: AppError): number {
  return error.status;
}
