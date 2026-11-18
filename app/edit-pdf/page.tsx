import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("edit-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Edit PDF",
  description: tool?.summary,
};

export default function EditPdf() {
  return <ToolPage toolId="edit-pdf" />;
}
