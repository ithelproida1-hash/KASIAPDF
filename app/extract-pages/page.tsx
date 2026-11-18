import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("extract-pages");

export const metadata: Metadata = {
  title: tool?.name ?? "Extract Pages",
  description: tool?.summary,
};

export default function ExtractPages() {
  return <ToolPage toolId="extract-pages" />;
}