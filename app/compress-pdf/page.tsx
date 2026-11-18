import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("compress-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Compress PDF",
  description: tool?.summary,
};

export default function CompressPdfPage() {
  return <ToolPage toolId="compress-pdf" />;
}
