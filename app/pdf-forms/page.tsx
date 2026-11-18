import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("pdf-forms");

export const metadata: Metadata = {
  title: tool?.name ?? "PDF Forms",
  description: tool?.summary,
};

export default function PdfForms() {
  return <ToolPage toolId="pdf-forms" />;
}
