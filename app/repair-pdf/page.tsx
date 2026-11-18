import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("repair-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Repair PDF",
  description: tool?.summary,
};

export default function RepairPdf() {
  return <ToolPage toolId="repair-pdf" />;
}