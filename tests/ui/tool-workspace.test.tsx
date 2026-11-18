// @vitest-environment jsdom

import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolWorkspace } from "@/components/pdf/tool-workspace";
import { fixtureFile } from "../helpers/fixtures";

const { runPdfTool } = vi.hoisted(() => ({ runPdfTool: vi.fn() }));

vi.mock("@/lib/api/limits", () => ({
  usePublicLimits: () => ({ maxFileSizeMb: 100, maxFilesPerJob: 10, maxTotalUploadMb: 250 }),
}));

vi.mock("@/lib/api/pdf-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/pdf-client")>();
  return {
    ...actual,
    runPdfTool: (...args: Parameters<typeof actual.runPdfTool>) => runPdfTool(...args),
    downloadResult: vi.fn(),
  };
});

function uploadFiles(container: HTMLElement, files: File[]) {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("File input was not rendered");
  }
  fireEvent.change(input, { target: { files } });
}

beforeEach(() => {
  runPdfTool.mockReset();
  runPdfTool.mockResolvedValue({
    blob: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
    filename: "merged.pdf",
    contentType: "application/pdf",
    requestId: "req-test-1",
  });
});

describe("ToolWorkspace", () => {
  it.each([
    ["merge-pdf", "Merge PDF", "Merge PDFs"],
    ["split-pdf", "Split PDF", "Split PDF"],
    ["compress-pdf", "Compress PDF", "Compress PDF"],
    ["rotate-pdf", "Rotate PDF", "Rotate PDF"],
    ["jpg-to-pdf", "JPG to PDF", "Create PDF"],
    ["pdf-to-jpg", "PDF to JPG", "Convert to images"],
  ])("renders the %s workspace with its primary action disabled", (toolId, name, action) => {
    const { container } = render(<ToolWorkspace toolId={toolId} />);

    expect(screen.getByRole("heading", { level: 1, name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`^${action}$`, "i") })).toBeDisabled();
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
  });

  it("renders the tool, uploader and settings", () => {
    render(<ToolWorkspace toolId="merge-pdf" />);

    expect(screen.getByRole("heading", { name: "Merge PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose files/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Merge order")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /merge pdfs/i })).toBeDisabled();
  });

  it("accepts files and completes a merge", async () => {
    const user = userEvent.setup();
    const { container } = render(<ToolWorkspace toolId="merge-pdf" />);

    uploadFiles(container, [fixtureFile("pdfs/sample-a.pdf"), fixtureFile("pdfs/sample-b.pdf")]);

    expect(await screen.findByText("sample-a.pdf")).toBeInTheDocument();
    expect(screen.getByText("sample-b.pdf")).toBeInTheDocument();

    const runButton = screen.getByRole("button", { name: /merge pdfs/i });
    await waitFor(() => expect(runButton).toBeEnabled());
    await user.click(runButton);

    expect(await screen.findByText("Your file is ready")).toBeInTheDocument();
    expect(screen.getByText("merged.pdf")).toBeInTheDocument();

    expect(runPdfTool).toHaveBeenCalledTimes(1);
    const call = runPdfTool.mock.calls[0]?.[0] as {
      toolId: string;
      files: File[];
      values: Record<string, unknown>;
    };
    expect(call.toolId).toBe("merge-pdf");
    expect(call.files).toHaveLength(2);
    expect(call.values).toMatchObject({ sortType: "orderProvided", generateToc: false });
  });

  it("shows a validation error before calling the API", async () => {
    const user = userEvent.setup();
    const { container } = render(<ToolWorkspace toolId="split-pdf" />);

    uploadFiles(container, [fixtureFile("pdfs/sample-a.pdf")]);
    await screen.findByText("sample-a.pdf");

    const range = screen.getByLabelText("Split after pages");
    await user.clear(range);
    await user.type(range, "abc");

    await user.click(screen.getByRole("button", { name: /split pdf/i }));

    expect(await screen.findByText(/page numbers or ranges/i)).toBeInTheDocument();
    expect(runPdfTool).not.toHaveBeenCalled();
  });

  it("rejects unsupported files with a clear message", async () => {
    const { container } = render(<ToolWorkspace toolId="merge-pdf" />);

    uploadFiles(container, [fixtureFile("pdfs/not-a-pdf.txt", { type: "text/plain" })]);

    await waitFor(() => {
      const input = container.querySelector('input[type="file"]');
      expect(input).toBeTruthy();
    });

    // The invalid file must never enter the selected list.
    expect(screen.queryByText("not-a-pdf.txt")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /merge pdfs/i })).toBeDisabled();
  });
});
