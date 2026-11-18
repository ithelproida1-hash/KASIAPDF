import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("pdf-to-powerpoint");

export const metadata: Metadata = {
  title: tool?.name ?? "PDF to PowerPoint",
  description: tool?.summary,
};

export default function PdfToPowerpoint() {
  return <ToolPage toolId="pdf-to-powerpoint" />;
}