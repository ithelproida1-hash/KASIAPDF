/**
 * Stirling-PDF REST endpoints.
 *
 * Verified against the live OpenAPI specification (v3.2.1):
 *   https://api.stirling.com/v1/api-docs
 * Documentation: https://docs.stirlingpdf.com/Developers/API/
 *
 * Last verified: 2026-11-18.
 * Do not add endpoints here without confirming them in the installed
 * server's /swagger-ui/index.html or /v1/api-docs.
 */
export const STIRLING_ENDPOINTS = {
  status: "/api/v1/info/status",
  mergePdfs: "/api/v1/general/merge-pdfs",
  splitPages: "/api/v1/general/split-pages",
  compressPdf: "/api/v1/misc/compress-pdf",
  rotatePdf: "/api/v1/general/rotate-pdf",
  imagesToPdf: "/api/v1/convert/img/pdf",
  pdfToImages: "/api/v1/convert/pdf/img",

  // Documented for the Phase 2 job-based flow (async=true), not used yet.
  jobStatus: (jobId: string) => `/api/v1/general/job/${encodeURIComponent(jobId)}`,
  jobResult: (jobId: string) => `/api/v1/general/job/${encodeURIComponent(jobId)}/result`,
} as const;

export type StirlingEndpoint = Exclude<
  (typeof STIRLING_ENDPOINTS)[keyof typeof STIRLING_ENDPOINTS],
  (...args: never[]) => string
>;
