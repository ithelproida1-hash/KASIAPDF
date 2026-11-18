import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("remove-pages");

export const metadata: Metadata = {
  title: tool?.name ?? "Remove Pages",
  description: tool?.summary,
};

export default function RemovePages() {
  return <ToolPage toolId="remove-pages" />;
}