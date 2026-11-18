import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("protect-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Protect PDF",
  description: tool?.summary,
};

export default function ProtectPdf() {
  return <ToolPage toolId="protect-pdf" />;
}