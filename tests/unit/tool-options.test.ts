import { describe, expect, it } from "vitest";

import {
  TOOL_FORMS,
  getToolForm,
  hasToolForm,
  readToolValues,
  validateToolValues,
} from "@/lib/pdf/tool-options";

function valuesFor(toolId: keyof typeof TOOL_FORMS) {
  return { ...TOOL_FORMS[toolId].defaults };
}

describe("tool form configuration", () => {
  it("has valid defaults for every implemented tool", () => {
    for (const [toolId, config] of Object.entries(TOOL_FORMS)) {
      const result = config.schema.safeParse(config.defaults);
      expect(result.success, `${toolId} defaults must validate`).toBe(true);
    }
  });

  it("declares a field for every non-optional value", () => {
    for (const [toolId, config] of Object.entries(TOOL_FORMS)) {
      const fieldNames = new Set<string>(config.fields.map((field) => field.name));
      for (const key of Object.keys(config.defaults)) {
        expect(fieldNames.has(key), `${toolId}.${key} has no field`).toBe(true);
      }
    }
  });

  it("exposes forms only for implemented tools", () => {
    expect(hasToolForm("merge-pdf")).toBe(true);
    expect(hasToolForm("watermark-pdf")).toBe(false);
    expect(getToolForm("merge-pdf")).toBeDefined();
    expect(getToolForm("rotate-pdf")).toBeDefined();
  });
});

describe("split page selection", () => {
  const config = getToolForm("split-pdf")!;

  it.each(["all", "ALL", "3", "2,5-9", "1,3,5-9", "2n+1"])("accepts %s", (pageNumbers) => {
    const result = validateToolValues(config, { pageNumbers });
    if (pageNumbers === "2n+1") {
      // Function syntax is supported by Stirling but not advertised in the UI.
      expect(result.success).toBe(false);
    } else {
      expect(result.success).toBe(true);
    }
  });

  it.each(["", "abc", "0,1", "1-", "1,,2", "-3"])("rejects %s", (pageNumbers) => {
    const result = validateToolValues(config, { pageNumbers });
    expect(result.success).toBe(false);
  });

  it("returns a friendly message", () => {
    const result = validateToolValues(config, { pageNumbers: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toMatch(/page number/i);
      expect(result.field).toBe("pageNumbers");
    }
  });
});

describe("numeric and boolean options", () => {
  it("enforces compression bounds", () => {
    const config = getToolForm("compress-pdf")!;

    expect(
      validateToolValues(config, { ...valuesFor("compress-pdf"), optimizeLevel: 1 }).success,
    ).toBe(true);
    expect(
      validateToolValues(config, { ...valuesFor("compress-pdf"), optimizeLevel: 9 }).success,
    ).toBe(true);
    expect(
      validateToolValues(config, { ...valuesFor("compress-pdf"), optimizeLevel: 0 }).success,
    ).toBe(false);
    expect(
      validateToolValues(config, { ...valuesFor("compress-pdf"), optimizeLevel: 10 }).success,
    ).toBe(false);
  });

  it("coerces the rotate angle from form data", () => {
    const config = getToolForm("rotate-pdf")!;

    expect(validateToolValues(config, { angle: "90" }).success).toBe(true);
    expect(validateToolValues(config, { angle: 270 }).success).toBe(true);
    expect(validateToolValues(config, { angle: "45" }).success).toBe(false);
  });

  it("enforces DPI bounds for PDF to images", () => {
    const config = getToolForm("pdf-to-jpg")!;

    expect(validateToolValues(config, { ...valuesFor("pdf-to-jpg"), dpi: 72 }).success).toBe(true);
    expect(validateToolValues(config, { ...valuesFor("pdf-to-jpg"), dpi: 600 }).success).toBe(true);
    expect(validateToolValues(config, { ...valuesFor("pdf-to-jpg"), dpi: 900 }).success).toBe(
      false,
    );
  });
});

describe("readToolValues", () => {
  it("parses switches, numbers and strings from FormData", () => {
    const config = getToolForm("compress-pdf")!;
    const form = new FormData();
    form.set("optimizeLevel", "7");
    form.set("grayscale", "true");
    form.set("linearize", "false");

    const values = readToolValues(form, config);
    expect(values).toEqual({ optimizeLevel: 7, grayscale: true, linearize: false });
  });

  it("keeps defaults for omitted fields", () => {
    const config = getToolForm("merge-pdf")!;
    const values = readToolValues(new FormData(), config);

    expect(values).toEqual({ sortType: "orderProvided", generateToc: false });
  });

  it("passes through unexpected option names for schema rejection", () => {
    const config = getToolForm("merge-pdf")!;
    const form = new FormData();
    form.set("sortType", "byVibes");

    expect(validateToolValues(config, readToolValues(form, config)).success).toBe(false);
  });
});
