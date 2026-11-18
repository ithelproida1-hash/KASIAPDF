import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("pdf-to-jpg");

export const metadata: Metadata = {
  title: tool?.name ?? "PDF to JPG",
  description: tool?.summary,
};

export default function PdfToJpgPage() {
  return <ToolPage toolId="pdf-to-jpg" />;
}
