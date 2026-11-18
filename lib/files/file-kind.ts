/**
 * File type detection based on magic bytes (not the browser-supplied MIME type).
 * Pure module: safe to import from both server and client code.
 */

export type FileKind =
  | "pdf"
  | "jpeg"
  | "png"
  | "webp"
  | "gif"
  | "tiff"
  | "bmp"
  | "zip"
  | "ole"
  | "html"
  | "unknown";

export type FileKindInfo = {
  mime: string;
  extensions: readonly string[];
  label: string;
};

export const FILE_KIND_INFO: Record<Exclude<FileKind, "unknown">, FileKindInfo> = {
  pdf: { mime: "application/pdf", extensions: [".pdf"], label: "PDF" },
  jpeg: { mime: "image/jpeg", extensions: [".jpg", ".jpeg"], label: "JPEG image" },
  png: { mime: "image/png", extensions: [".png"], label: "PNG image" },
  webp: { mime: "image/webp", extensions: [".webp"], label: "WebP image" },
  gif: { mime: "image/gif", extensions: [".gif"], label: "GIF image" },
  tiff: { mime: "image/tiff", extensions: [".tif", ".tiff"], label: "TIFF image" },
  bmp: { mime: "image/bmp", extensions: [".bmp"], label: "Bitmap image" },
  zip: { mime: "application/zip", extensions: [".zip"], label: "Office document or ZIP" },
  ole: {
    mime: "application/octet-stream",
    extensions: [".doc", ".ppt", ".xls"],
    label: "Legacy Office document",
  },
  html: { mime: "text/html", extensions: [".html", ".htm"], label: "HTML document" },
};

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function matchesAscii(bytes: Uint8Array, text: string, offset = 0): boolean {
  return startsWith(
    bytes,
    [...text].map((char) => char.charCodeAt(0)),
    offset,
  );
}

function looksLikeHtml(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 512))
    .trimStart()
    .toLowerCase();

  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<body") ||
    (head.startsWith("<?xml") && head.includes("<html"))
  );
}

export function detectFileKind(bytes: Uint8Array): FileKind {
  if (bytes.length === 0) {
    return "unknown";
  }

  if (matchesAscii(bytes, "%PDF-")) {
    return "pdf";
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  if (matchesAscii(bytes, "GIF87a") || matchesAscii(bytes, "GIF89a")) {
    return "gif";
  }

  if (matchesAscii(bytes, "RIFF") && matchesAscii(bytes, "WEBP", 8)) {
    return "webp";
  }

  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "tiff";
  }

  if (matchesAscii(bytes, "BM")) {
    return "bmp";
  }

  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return "zip";
  }

  // OLE compound document: legacy .doc, .ppt and .xls files.
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return "ole";
  }

  if (looksLikeHtml(bytes)) {
    return "html";
  }

  return "unknown";
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function kindMatchesExtension(kind: FileKind, filename: string): boolean {
  if (kind === "unknown") return false;
  return FILE_KIND_INFO[kind].extensions.includes(extensionOf(filename));
}

export function firstExtensionForKind(kind: Exclude<FileKind, "unknown">): string {
  return FILE_KIND_INFO[kind].extensions[0] ?? "";
}
