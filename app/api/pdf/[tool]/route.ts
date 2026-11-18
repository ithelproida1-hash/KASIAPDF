import { handlePdfToolRequest } from "@/lib/pdf/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Large documents can take a while; keep in step with STIRLING_TIMEOUT_MS. */
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ tool: string }> },
): Promise<Response> {
  const { tool } = await context.params;
  return handlePdfToolRequest(request, tool);
}
