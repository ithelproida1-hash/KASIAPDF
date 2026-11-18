import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("pdf-to-word");

export const metadata: Metadata = {
  title: tool?.name ?? "PDF to Word",
  description: tool?.summary,
};

export default function PdfToWord() {
  return <ToolPage toolId="pdf-to-word" />;
}