import { AppError } from "@/lib/errors";

/**
 * Maps a non-2xx Stirling response to a safe application error.
 * The upstream body is deliberately not surfaced to the user or logged.
 */
export function mapUpstreamFailure(status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError("STIRLING_UNAUTHORIZED", "Stirling rejected the API credentials", {
      details: { upstreamStatus: status },
    });
  }

  if (status === 413) {
    return new AppError("FILE_TOO_LARGE", "Stirling rejected the upload as too large", {
      details: { upstreamStatus: status },
    });
  }

  if (status === 429) {
    return new AppError("RATE_LIMITED", "Stirling rate limited the request", {
      retryable: true,
      details: { upstreamStatus: status },
    });
  }

  if (status === 400 || status === 422) {
    return new AppError("STIRLING_REJECTED", "Stirling rejected the request payload", {
      details: { upstreamStatus: status },
    });
  }

  if (status === 404) {
    return new AppError("PROCESSING_FAILED", "Stirling endpoint was not found", {
      details: { upstreamStatus: status },
    });
  }

  if (status >= 500) {
    return new AppError("PROCESSING_FAILED", "Stirling returned a server error", {
      retryable: true,
      details: { upstreamStatus: status },
    });
  }

  return new AppError("PROCESSING_FAILED", "Stirling returned an unexpected response", {
    details: { upstreamStatus: status },
  });
}
