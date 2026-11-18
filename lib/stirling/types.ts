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

export type RemovePagesOptions = {
  pageNumbers: string;
};

export type RearrangePagesMode =
  | "CUSTOM"
  | "REVERSE_ORDER"
  | "DUPLEX_SORT"
  | "BOOKLET_SORT"
  | "SIDE_STITCH_BOOKLET_SORT"
  | "ODD_EVEN_SPLIT"
  | "REMOVE_FIRST"
  | "REMOVE_LAST"
  | "REMOVE_FIRST_AND_LAST"
  | "DUPLICATE";

export type RearrangePagesOptions = {
  pageNumbers?: string;
  customMode?: RearrangePagesMode;
};

export type CropOptions = {
  pageNumbers?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  autoCrop?: boolean;
  removeDataOutsideCrop?: boolean;
};

export type PdfToWordOptions = {
  outputFormat?: "doc" | "docx" | "odt";
};

export type PdfToPresentationOptions = {
  outputFormat?: "ppt" | "pptx" | "odp";
};

export type PdfToPdfAOptions = {
  outputFormat?: "pdfa" | "pdfa-1" | "pdfa-2" | "pdfa-2b" | "pdfa-3" | "pdfa-3b" | "pdfx";
  pdfUa?: boolean;
  strict?: boolean;
};

export type HtmlToPdfOptions = {
  zoom?: number;
};

export type WatermarkOptions = {
  watermarkText: string;
  fontSize?: number;
  rotation?: number;
  opacity?: number;
  customColor?: string;
  convertPDFToImage?: boolean;
};

export type PageNumberOptions = {
  pageNumbers: string;
  fontType?: "helvetica" | "courier" | "times";
  position?: number;
  customText?: string;
  startingNumber?: number;
  fontSize?: number;
  fontColor?: string;
};

export type RemovePasswordOptions = {
  password: string;
  removeAll?: boolean;
};

export type AddPasswordOptions = {
  password: string;
  ownerPassword?: string;
  keyLength?: 40 | 128 | 256;
  preventPrinting?: boolean;
  preventModify?: boolean;
  preventExtractContent?: boolean;
};

export type OcrOptions = {
  languages?: string;
  ocrType?: "skip-text" | "force-ocr" | "Normal";
  deskew?: boolean;
  rotatePages?: boolean;
  clean?: boolean;
};

export type RedactOptions = {
  listOfText: string;
  useRegex?: boolean;
  wholeWordSearch?: boolean;
  caseSensitive?: boolean;
  redactColor?: string;
  convertPDFToImage?: boolean;
};

/** JSON payload for /api/v1/form/fill. */
export type FormFillOptions = {
  /** JSON object of field-name to value pairs. */
  data: string;
  flatten?: boolean;
};

export type FormExtractOptions = {
  /** Optional JSON object pre-filling the exported table. */
  data?: string;
};

export type StampMargin = "small" | "medium" | "large" | "x-large";

export type AddStampOptions = {
  stampType: "text" | "image";
  pageNumbers?: string;
  stampText?: string;
  stampImage?: UploadedFile;
  /** 1-9, matching a 3x3 grid. */
  position?: number;
  fontSize?: number;
  opacity?: number;
  customColor?: string;
  rotation?: number;
  customMargin?: StampMargin;
  overrideX?: number;
  overrideY?: number;
};

export type CertSignOptions = {
  certType: "SERVER";
  showSignature?: boolean;
  showLogo?: boolean;
  reason?: string;
  location?: string;
  name?: string;
  pageNumber?: number;
};

export type PdfTextOptions = {
  outputFormat?: "txt" | "rtf";
};

export type PipelineStep = {
  operation: string;
  parameters?: Record<string, unknown>;
};

export type PipelineOptions = {
  name: string;
  pipeline: PipelineStep[];
};
