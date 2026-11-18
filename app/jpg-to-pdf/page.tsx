import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("jpg-to-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "JPG to PDF",
  description: tool?.summary,
};

export default function JpgToPdfPage() {
  return <ToolPage toolId="jpg-to-pdf" />;
}
