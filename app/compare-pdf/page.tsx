import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("compare-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Compare PDF",
  description: tool?.summary,
};

export default function ComparePdf() {
  return <ToolPage toolId="compare-pdf" />;
}
