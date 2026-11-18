import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("watermark-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Watermark PDF",
  description: tool?.summary,
};

export default function WatermarkPdf() {
  return <ToolPage toolId="watermark-pdf" />;
}