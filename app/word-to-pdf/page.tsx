import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("word-to-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Word to PDF",
  description: tool?.summary,
};

export default function WordToPdf() {
  return <ToolPage toolId="word-to-pdf" />;
}