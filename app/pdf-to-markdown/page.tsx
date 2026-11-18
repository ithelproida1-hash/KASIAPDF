import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("pdf-to-markdown");

export const metadata: Metadata = {
  title: tool?.name ?? "PDF to Markdown",
  description: tool?.summary,
};

export default function PdfToMarkdown() {
  return <ToolPage toolId="pdf-to-markdown" />;
}
