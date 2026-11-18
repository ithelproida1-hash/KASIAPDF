import type { Metadata } from "next";

import { ToolPage } from "@/components/pdf/tool-page";
import { getToolById } from "@/lib/pdf/tools";

const tool = getToolById("sign-pdf");

export const metadata: Metadata = {
  title: tool?.name ?? "Sign PDF",
  description: tool?.summary,
};

export default function SignPdf() {
  return <ToolPage toolId="sign-pdf" />;
}
