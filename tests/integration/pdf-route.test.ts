import { describe, expect, it, vi } from "vitest";

const handler = vi.hoisted(() => vi.fn(async () => new Response("delegated", { status: 200 })));

vi.mock("@/lib/pdf/handler", () => ({
  handlePdfToolRequest: handler,
}));

import { POST, runtime } from "@/app/api/pdf/[tool]/route";

describe("POST /api/pdf/[tool]", () => {
  it("runs on the Node.js runtime with a long duration budget", () => {
    expect(runtime).toBe("nodejs");
  });

  it("awaits route params and delegates to the shared handler", async () => {
    const request = new Request("http://localhost/api/pdf/merge-pdf", { method: "POST" });

    const response = await POST(request, {
      params: Promise.resolve({ tool: "merge-pdf" }),
    });

    expect(handler).toHaveBeenCalledWith(request, "merge-pdf");
    expect(await response.text()).toBe("delegated");
  });
});
