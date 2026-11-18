import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  TOOLS,
  getAvailableTools,
  getNavigationGroups,
  getRelatedTools,
  getToolById,
  getToolBySlug,
} from "@/lib/pdf/tools";
import { getToolForm, hasToolForm } from "@/lib/pdf/tool-options";

describe("tool registry", () => {
  it("uses unique ids and slugs", () => {
    const ids = TOOLS.map((tool) => tool.id);
    const slugs = TOOLS.map((tool) => tool.slug);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every available tool a verified endpoint and a form", () => {
    // Tools that genuinely have no settings still need a form config so the
    // shared handler can validate an empty option set.
    const optionlessTools = new Set([
      "pdf-to-excel",
      "word-to-pdf",
      "powerpoint-to-pdf",
      "excel-to-pdf",
      "repair-pdf",
      "pdf-to-markdown",
    ]);

    for (const tool of getAvailableTools()) {
      expect(tool.endpoint, `${tool.id} endpoint`).toMatch(/^\/api\/v1\//);
      expect(hasToolForm(tool.id), `${tool.id} form config`).toBe(true);

      if (optionlessTools.has(tool.id)) {
        expect(getToolForm(tool.id)?.fields.length, `${tool.id} fields`).toBe(0);
      } else {
        expect(getToolForm(tool.id)?.fields.length, `${tool.id} fields`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps planned tools unreachable", () => {
    for (const tool of TOOLS.filter((candidate) => candidate.status === "planned")) {
      expect(tool, `${tool.id} must not declare an endpoint`).not.toHaveProperty("endpoint");
    }
  });

  it("ships the six Phase 1 tools", () => {
    const available = new Set(getAvailableTools().map((tool) => tool.id));

    for (const id of [
      "merge-pdf",
      "split-pdf",
      "compress-pdf",
      "rotate-pdf",
      "jpg-to-pdf",
      "pdf-to-jpg",
    ]) {
      expect(available.has(id), id).toBe(true);
    }
  });

  it("ships the Phase 2 tools with verified endpoints", () => {
    const available = new Set(getAvailableTools().map((tool) => tool.id));

    for (const id of [
      "remove-pages",
      "extract-pages",
      "organize-pdf",
      "pdf-to-word",
      "pdf-to-powerpoint",
      "pdf-to-excel",
      "word-to-pdf",
      "powerpoint-to-pdf",
      "excel-to-pdf",
      "html-to-pdf",
      "pdf-to-pdfa",
      "watermark-pdf",
      "page-numbers",
      "crop-pdf",
      "unlock-pdf",
      "protect-pdf",
      "ocr-pdf",
      "repair-pdf",
      "redact-pdf",
    ]) {
      expect(available.has(id), id).toBe(true);
    }
  });

  it("ships the remaining document tools with verified endpoints", () => {
    const available = new Set(getAvailableTools().map((tool) => tool.id));

    for (const id of [
      "edit-pdf",
      "pdf-forms",
      "sign-pdf",
      "compare-pdf",
      "pdf-to-markdown",
      "web-to-pdf",
      "workflows",
      "scan-pdf",
    ]) {
      expect(available.has(id), id).toBe(true);
    }
  });

  it("maps categories in display order", () => {
    const orders = CATEGORIES.map((category) => category.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it("builds navigation groups from available tools only", () => {
    const groups = getNavigationGroups();
    expect(groups.length).toBeGreaterThan(0);

    for (const group of groups) {
      expect(group.tools.length).toBeGreaterThan(0);
      expect(group.tools.every((tool) => tool.category === group.id)).toBe(true);
    }

    const navigable = groups.flatMap((group) => group.tools.map((tool) => tool.id));
    expect(navigable).toContain("merge-pdf");
  });

  it("looks up tools by id and slug", () => {
    expect(getToolById("merge-pdf")?.slug).toBe("merge-pdf");
    expect(getToolBySlug("merge-pdf")?.id).toBe("merge-pdf");
    expect(getToolById("does-not-exist")).toBeUndefined();
  });

  it("suggests only available related tools from the same category", () => {
    const merge = getToolById("merge-pdf");
    expect(merge).toBeDefined();

    const related = getRelatedTools(merge!);
    expect(related.every((tool) => tool.status === "available")).toBe(true);
    expect(related.every((tool) => tool.id !== "merge-pdf")).toBe(true);
  });
});
