import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("workflows");

export const metadata: Metadata = {
  title: tool?.name ?? "Workflows",
  description: tool?.summary,
};

export default function Workflows() {
  return <ToolPage toolId="workflows" />;
}
