import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("html-to-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "HTML to PDF",
  description: tool?.summary,
};

export default function HtmlToPdf() {
  return <ToolPage toolId="html-to-pdf" />;
}