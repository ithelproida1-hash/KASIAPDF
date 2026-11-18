import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("redact-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Redact PDF",
  description: tool?.summary,
};

export default function RedactPdf() {
  return <ToolPage toolId="redact-pdf" />;
}