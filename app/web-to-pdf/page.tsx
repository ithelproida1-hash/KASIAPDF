import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("web-to-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Web to PDF",
  description: tool?.summary,
};

export default function WebToPdf() {
  return <ToolPage toolId="web-to-pdf" />;
}
