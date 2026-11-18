import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("organize-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Organize PDF",
  description: tool?.summary,
};

export default function OrganizePdf() {
  return <ToolPage toolId="organize-pdf" />;
}