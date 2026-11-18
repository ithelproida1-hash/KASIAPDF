import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("unlock-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Unlock PDF",
  description: tool?.summary,
};

export default function UnlockPdf() {
  return <ToolPage toolId="unlock-pdf" />;
}