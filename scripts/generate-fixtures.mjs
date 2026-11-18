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

function buildPdfFromObjects(objects) {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}

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
    objects.push(`<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`);
  });

  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  return buildPdfFromObjects(objects);
}

/** A one-page PDF with two real AcroForm text fields (fullName and date). */
function buildFormPdf() {
  const content = "BT /F1 14 Tf 72 780 Td (Employee form) Tj ET";

  return buildPdfFromObjects([
    `<< /Type /Catalog /Pages 2 0 R /AcroForm 7 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 8 0 R >> >> /Annots [5 0 R 6 0 R] >>`,
    `<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`,
    `<< /Type /Annot /Subtype /Widget /FT /Tx /T (fullName) /V () /Rect [72 700 360 724] /P 3 0 R /F 4 /DA (/Helv 12 Tf 0 g) /MK << /BC [0 0 0] /BG [1 1 1] >> >>`,
    `<< /Type /Annot /Subtype /Widget /FT /Tx /T (date) /V () /Rect [72 660 240 684] /P 3 0 R /F 4 /DA (/Helv 12 Tf 0 g) /MK << /BC [0 0 0] /BG [1 1 1] >> >>`,
    `<< /Fields [5 0 R 6 0 R] /DA (/Helv 0 Tf 0 g) /DR << /Font << /Helv 8 0 R >> >> /NeedAppearances true >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  ]);
}

writeFileSync(join(pdfDir, "sample-a.pdf"), buildPdf(["Sample A - Page 1"]));
writeFileSync(join(pdfDir, "sample-b.pdf"), buildPdf(["Sample B - Page 1", "Sample B - Page 2"]));
writeFileSync(
  join(pdfDir, "sample-c.pdf"),
  buildPdf(["Sample C - Page 1", "Sample C - Page 2", "Sample C - Page 3"]),
);
writeFileSync(join(pdfDir, "form-sample.pdf"), buildFormPdf());

// 1x1 PNG and 8x8 JPEG, small enough to commit and safe by inspection. The
// JPEG must be a complete baseline image; truncated tables break Java's reader.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==",
  "base64",
);

writeFileSync(join(imageDir, "pixel.png"), png);
writeFileSync(join(imageDir, "pixel.jpg"), jpeg);
writeFileSync(join(pdfDir, "not-a-pdf.txt"), "This is intentionally not a PDF.\n");

console.log(`Fixtures written to ${join(root, "tests", "fixtures")}`);
