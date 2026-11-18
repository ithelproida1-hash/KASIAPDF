/**
 * Generates small, valid fixtures for tests and manual smoke checks.
 * Run with: pnpm fixtures
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pdfDir = join(root, "tests", "fixtures", "pdfs");
const imageDir = join(root, "tests", "fixtures", "images");

mkdirSync(pdfDir, { recursive: true });
mkdirSync(imageDir, { recursive: true });

function buildPdf(pageTexts) {
  const objects = [];
  const fontObjectNumber = 3 + pageTexts.length * 2;

  const kids = pageTexts.map((_, index) => `${3 + index * 2} 0 R`).join(" ");

  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageTexts.length} >>`);

  pageTexts.forEach((text, index) => {
    const contentNumber = 4 + index * 2;
    const content = `BT /F1 24 Tf 72 760 Td (${text}) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentNumber} 0 R /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> >>`,
    );
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  });

  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}

writeFileSync(join(pdfDir, "sample-a.pdf"), buildPdf(["Company PDF Platform — Sample A"]));
writeFileSync(join(pdfDir, "sample-b.pdf"), buildPdf(["Sample B — Page 1", "Sample B — Page 2"]));
writeFileSync(
  join(pdfDir, "sample-c.pdf"),
  buildPdf(["Sample C — Page 1", "Sample C — Page 2", "Sample C — Page 3"]),
);

// 1x1 pixel images, small enough to commit and safe by inspection.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==",
  "base64",
);

writeFileSync(join(imageDir, "pixel.png"), png);
writeFileSync(join(imageDir, "pixel.jpg"), jpeg);
writeFileSync(join(pdfDir, "not-a-pdf.txt"), "This is intentionally not a PDF.\n");

console.log(`Fixtures written to ${join(root, "tests", "fixtures")}`);
