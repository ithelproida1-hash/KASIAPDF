import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("pdf-to-pdfa");

export const metadata: Metadata = {
  title: tool?.name ?? "PDF to PDF/A",
  description: tool?.summary,
};

export default function PdfToPdfa() {
  return <ToolPage toolId="pdf-to-pdfa" />;
}