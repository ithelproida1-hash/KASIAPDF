import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("crop-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Crop PDF",
  description: tool?.summary,
};

export default function CropPdf() {
  return <ToolPage toolId="crop-pdf" />;
}