import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("split-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Split PDF",
  description: tool?.summary,
};

export default function SplitPdfPage() {
  return <ToolPage toolId="split-pdf" />;
}
