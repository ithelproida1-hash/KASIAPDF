import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("ocr-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "OCR PDF",
  description: tool?.summary,
};

export default function OcrPdf() {
  return <ToolPage toolId="ocr-pdf" />;
}