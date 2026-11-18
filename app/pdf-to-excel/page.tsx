import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("pdf-to-excel");

export const metadata: Metadata = {
  title: tool?.name ?? "PDF to Excel",
  description: tool?.summary,
};

export default function PdfToExcel() {
  return <ToolPage toolId="pdf-to-excel" />;
}