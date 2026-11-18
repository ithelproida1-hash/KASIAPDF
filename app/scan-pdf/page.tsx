import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("scan-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Scan PDF",
  description: tool?.summary,
};

export default function ScanPdf() {
  return <ToolPage toolId="scan-pdf" />;
}
