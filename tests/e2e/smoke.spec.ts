import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const FIXTURES = path.join(__dirname, "..", "fixtures");
const SAMPLE_PDF = path.join(FIXTURES, "pdfs", "sample-a.pdf");

/** A minimal result the UI can show without a real Stirling-PDF instance. */
const FAKE_RESULT = readFileSync(SAMPLE_PDF);

test.describe("Phase 1 smoke", () => {
  test("shows branding, activity counts and developer credits", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Jindal Kasia PDF").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sanjay Nayak" })).toBeVisible();
    await expect(page.getByText("Developed by Sanjay Nayak")).toBeVisible();
    await expect(page.getByText(/Made with/).first()).toContainText("in India");
    await expect(page.getByText(/For internal use only/).first()).toBeVisible();

    await expect(page.getByTestId("daily-visitors")).not.toHaveText("—", { timeout: 10_000 });
    await expect(page.getByTestId("online-users")).not.toHaveText("—", { timeout: 10_000 });

    await page.mouse.click(480, 320);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const canvas = document.querySelector<HTMLCanvasElement>(
              '[data-testid="click-fireworks"]',
            );
            const context = canvas?.getContext("2d");
            if (!canvas || !context) return false;

            const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
            for (let index = 3; index < data.length; index += 4) {
              if (data[index] !== 0) return true;
            }
            return false;
          }),
        { timeout: 2_000 },
      )
      .toBe(true);
  });

  test("dashboard lists tools and filters by search", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Search tools" });
    await search.fill("merge");
    await expect(page.getByRole("link", { name: /merge pdf/i }).first()).toBeVisible();

    await search.fill("zzz-no-such-tool");
    await expect(page.getByText(/no tools match/i)).toBeVisible();
  });

  test("merge page uploads two PDFs and renders the result", async ({ page }) => {
    await page.route("**/api/pdf/merge-pdf", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: {
          "content-disposition": 'attachment; filename="merged.pdf"',
          "x-request-id": "req-e2e-merge",
          "cache-control": "no-store",
        },
        body: FAKE_RESULT,
      });
    });

    await page.goto("/merge-pdf");
    await expect(page.getByRole("heading", { name: "Merge PDF", exact: true })).toBeVisible();

    await page
      .locator('input[type="file"]')
      .setInputFiles([
        path.join(FIXTURES, "pdfs", "sample-a.pdf"),
        path.join(FIXTURES, "pdfs", "sample-b.pdf"),
      ]);
    await expect(page.getByText("sample-a.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Merge PDFs" }).click();

    await expect(page.getByRole("heading", { name: "Your file is ready" })).toBeVisible();
    await expect(page.getByText("merged.pdf")).toBeVisible();
    await expect(page.getByRole("button", { name: "Download" })).toBeEnabled();
  });

  test("PDF to Word enables OCR for scanned pages by default", async ({ page }) => {
    await page.goto("/pdf-to-word");

    const ocrSwitch = page.getByRole("switch", { name: /recognize scanned text/i });
    await expect(ocrSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.getByLabel("Document language")).toBeVisible();

    await ocrSwitch.click();

    await expect(ocrSwitch).toHaveAttribute("aria-checked", "false");
    await expect(page.getByLabel("Document language")).toHaveCount(0);
  });

  test("renders the editing and automation tool pages", async ({ page }) => {
    const pages = [
      ["/edit-pdf", "Edit PDF"],
      ["/pdf-forms", "PDF Forms"],
      ["/sign-pdf", "Sign PDF"],
      ["/compare-pdf", "Compare PDF"],
      ["/pdf-to-markdown", "PDF to Markdown"],
      ["/web-to-pdf", "Web to PDF"],
      ["/workflows", "Workflows"],
      ["/scan-pdf", "Scan PDF"],
    ] as const;

    for (const [route, heading] of pages) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("web to PDF runs without a file uploader", async ({ page }) => {
    await page.route("**/api/pdf/web-to-pdf", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: {
          "content-disposition": 'attachment; filename="web-page.pdf"',
          "x-request-id": "req-e2e-web",
        },
        body: FAKE_RESULT,
      });
    });

    await page.goto("/web-to-pdf");
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    await page.getByLabel("Web address").fill("https://example.com/article");
    await page.getByRole("button", { name: "Capture page" }).click();

    await expect(page.getByRole("heading", { name: "Your file is ready" })).toBeVisible();
    await expect(page.getByText("web-page.pdf")).toBeVisible();
  });

  test("engine errors are surfaced safely", async ({ page }) => {    await page.route("**/api/pdf/merge-pdf", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "STIRLING_UNAVAILABLE",
            message:
              "The PDF processing service is not reachable right now. Please try again in a moment.",
            requestId: "req-e2e-fail",
            retryable: true,
          },
        }),
      });
    });

    await page.goto("/merge-pdf");
    await page
      .locator('input[type="file"]')
      .setInputFiles([
        path.join(FIXTURES, "pdfs", "sample-a.pdf"),
        path.join(FIXTURES, "pdfs", "sample-b.pdf"),
      ]);
    await page.getByRole("button", { name: "Merge PDFs" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "The file could not be" }),
    ).toContainText(/not reachable right now/i);
    await expect(page.getByRole("button", { name: "Download" })).toHaveCount(0);
  });
});
