import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("powerpoint-to-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "PowerPoint to PDF",
  description: tool?.summary,
};

export default function PowerpointToPdf() {
  return <ToolPage toolId="powerpoint-to-pdf" />;
}