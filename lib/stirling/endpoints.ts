/**
 * Stirling-PDF REST endpoints.
 *
 * Verified against the live OpenAPI specification (v3.3.0):
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
  removePages: "/api/v1/general/remove-pages",
  rearrangePages: "/api/v1/general/rearrange-pages",
  cropPdf: "/api/v1/general/crop",
  pdfToWord: "/api/v1/convert/pdf/word",
  pdfToPresentation: "/api/v1/convert/pdf/presentation",
  pdfToExcel: "/api/v1/convert/pdf/xlsx",
  fileToPdf: "/api/v1/convert/file/pdf",
  htmlToPdf: "/api/v1/convert/html/pdf",
  pdfToPdfA: "/api/v1/convert/pdf/pdfa",
  addWatermark: "/api/v1/security/add-watermark",
  addPageNumbers: "/api/v1/misc/add-page-numbers",
  removePassword: "/api/v1/security/remove-password",
  addPassword: "/api/v1/security/add-password",
  ocrPdf: "/api/v1/misc/ocr-pdf",
  repairPdf: "/api/v1/misc/repair",
  autoRedact: "/api/v1/security/auto-redact",
  addStamp: "/api/v1/misc/add-stamp",
  certSign: "/api/v1/security/cert-sign",
  fillForm: "/api/v1/form/fill",
  extractFormCsv: "/api/v1/form/extract-csv",
  extractFormXlsx: "/api/v1/form/extract-xlsx",
  pdfToMarkdown: "/api/v1/convert/pdf/markdown",
  pdfToText: "/api/v1/convert/pdf/text",
  pipeline: "/api/v1/pipeline/handleData",

  // Documented for the Phase 2 job-based flow (async=true), not used yet.
  jobStatus: (jobId: string) => `/api/v1/general/job/${encodeURIComponent(jobId)}`,
  jobResult: (jobId: string) => `/api/v1/general/job/${encodeURIComponent(jobId)}/result`,
} as const;

export type StirlingEndpoint = Exclude<
  (typeof STIRLING_ENDPOINTS)[keyof typeof STIRLING_ENDPOINTS],
  (...args: never[]) => string
>;
