import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("page-numbers");

export const metadata: Metadata = {
  title: tool?.name ?? "Page Numbers",
  description: tool?.summary,
};

export default function PageNumbers() {
  return <ToolPage toolId="page-numbers" />;
}