import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("excel-to-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Excel to PDF",
  description: tool?.summary,
};

export default function ExcelToPdf() {
  return <ToolPage toolId="excel-to-pdf" />;
}