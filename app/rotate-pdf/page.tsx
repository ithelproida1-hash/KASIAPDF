import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("rotate-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Rotate PDF",
  description: tool?.summary,
};

export default function RotatePdfPage() {
  return <ToolPage toolId="rotate-pdf" />;
}
