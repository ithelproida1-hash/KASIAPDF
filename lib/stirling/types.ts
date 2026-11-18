/** Shared Stirling-PDF transport types. */

/** A file that has already passed validation and been read into memory. */
export type UploadedFile = {
  /** Safe, sanitized display/transport filename. */
  filename: string;
  contentType: string;
  bytes: Uint8Array<ArrayBuffer>;
};

export type StirlingFileResult = {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
  /** Raw Content-Disposition header from Stirling, when present. */
  contentDisposition?: string;
};

export type StirlingHealth = {
  reachable: boolean;
  responseTimeMs: number;
  version?: string;
  status?: string;
  error?: string;
};

export type StirlingStatusPayload = {
  status?: string;
  version?: string;
  [key: string]: unknown;
};

/** Sort orders accepted by /api/v1/general/merge-pdfs. */
export type MergeSortType =
  "orderProvided" | "byFileName" | "byDateModified" | "byDateCreated" | "byPDFTitle";

export type MergeOptions = {
  sortType?: MergeSortType;
  generateToc?: boolean;
  removeCertSign?: boolean;
};

export type SplitOptions = {
  pageNumbers: string;
};

export type CompressOptions = {
  optimizeLevel: number;
  grayscale?: boolean;
  linearize?: boolean;
  normalize?: boolean;
};

export type RotateOptions = {
  angle: 0 | 90 | 180 | 270;
};

export type ImageToPdfOptions = {
  fitOption?: "fillPage" | "fitDocumentToImage" | "fitDocumentToPage" | "maintainAspectRatio";
  colorType?: "color" | "greyscale" | "blackwhite";
  autoRotate?: boolean;
};

export type PdfToImageOptions = {
  imageFormat?: "png" | "jpeg" | "jpg" | "gif" | "webp";
  singleOrMultiple?: "single" | "multiple";
  colorType?: "color" | "greyscale" | "blackwhite";
  dpi?: number;
  pageNumbers?: string;
};
