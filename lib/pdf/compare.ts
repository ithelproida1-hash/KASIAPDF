/**
 * Text comparison used by the Compare PDF tool.
 *
 * Stirling does not expose a document-diff endpoint on this deployment, so both
 * PDFs are converted to text first and compared here. The result is a printable
 * HTML report that is rendered back to PDF by the engine.
 */

export type DiffRowType = "same" | "added" | "removed";

export type DiffRow = {
  type: DiffRowType;
  text: string;
  leftLine: number | null;
  rightLine: number | null;
};

type DiffOptions = {
  /** Guard rail for pathological documents. */
  maxLines?: number;
};

function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

/**
 * Line diff based on the longest common subsequence. Documents larger than the
 * cap are truncated with a visible notice instead of exhausting memory.
 */
export function diffLines(leftText: string, rightText: string, options: DiffOptions = {}): DiffRow[] {
  const maxLines = options.maxLines ?? 1_500;
  const leftAll = splitLines(leftText);
  const rightAll = splitLines(rightText);

  // Ignore a single trailing empty line produced by a final newline.
  if (leftAll.at(-1) === "" && leftAll.length > 1) leftAll.pop();
  if (rightAll.at(-1) === "" && rightAll.length > 1) rightAll.pop();

  const left = leftAll.slice(0, maxLines);
  const right = rightAll.slice(0, maxLines);
  const truncated = leftAll.length > maxLines || rightAll.length > maxLines;

  const rows = lcsDiff(left, right);

  if (truncated) {
    rows.push({
      type: "same",
      text: `… comparison truncated to the first ${maxLines.toLocaleString("en-GB")} lines per document.`,
      leftLine: null,
      rightLine: null,
    });
  }

  return rows;
}

function lcsDiff(left: string[], right: string[]): DiffRow[] {
  const n = left.length;
  const m = right.length;

  // table[i][j] is the LCS length of left[i..] and right[j..].
  const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));

  for (let i = n - 1; i >= 0; i--) {
    const row = table[i]!;
    const next = table[i + 1]!;

    for (let j = m - 1; j >= 0; j--) {
      row[j] = left[i] === right[j] ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (left[i] === right[j]) {
      rows.push({ type: "same", text: left[i]!, leftLine: i + 1, rightLine: j + 1 });
      i++;
      j++;
      continue;
    }

    if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      rows.push({ type: "removed", text: left[i]!, leftLine: i + 1, rightLine: null });
      i++;
    } else {
      rows.push({ type: "added", text: right[j]!, leftLine: null, rightLine: j + 1 });
      j++;
    }
  }

  while (i < n) {
    rows.push({ type: "removed", text: left[i]!, leftLine: i + 1, rightLine: null });
    i++;
  }

  while (j < m) {
    rows.push({ type: "added", text: right[j]!, leftLine: null, rightLine: j + 1 });
    j++;
  }

  return rows;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type ComparisonHtmlOptions = {
  /** Keep lines that are identical in both documents. */
  showUnchanged?: boolean;
  maxLines?: number;
};

export function buildComparisonHtml(
  leftName: string,
  leftText: string,
  rightName: string,
  rightText: string,
  options: ComparisonHtmlOptions = {},
): string {
  const rows = diffLines(leftText, rightText, { maxLines: options.maxLines });
  const added = rows.filter((row) => row.type === "added").length;
  const removed = rows.filter((row) => row.type === "removed").length;
  const visible = options.showUnchanged ? rows : rows.filter((row) => row.type !== "same");

  const body =
    visible.length === 0
      ? '<p class="empty">The documents have no differences.</p>'
      : visible
          .map((row) => {
            const marker = row.type === "added" ? "+" : row.type === "removed" ? "−" : " ";
            const leftLine = row.leftLine === null ? "" : String(row.leftLine);
            const rightLine = row.rightLine === null ? "" : String(row.rightLine);

            return `<div class="row ${row.type}"><span class="ln">${leftLine}</span><span class="ln">${rightLine}</span><span class="marker">${marker}</span><span class="text">${escapeHtml(row.text) || "&nbsp;"}</span></div>`;
          })
          .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Comparison report</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111827; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #4b5563; font-size: 11px; margin: 0 0 14px; }
  .summary { display: flex; gap: 14px; font-size: 11px; margin-bottom: 14px; }
  .summary span { padding: 4px 8px; border-radius: 4px; background: #f3f4f6; }
  .summary .add { color: #166534; background: #dcfce7; }
  .summary .del { color: #991b1b; background: #fee2e2; }
  .report { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
  .row { display: flex; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 9px; line-height: 1.45; border-bottom: 1px solid #f3f4f6; }
  .row:last-child { border-bottom: 0; }
  .ln { flex: 0 0 34px; padding: 1px 4px; text-align: right; color: #9ca3af; background: #fafafa; border-right: 1px solid #f3f4f6; }
  .marker { flex: 0 0 16px; text-align: center; font-weight: 700; }
  .text { flex: 1 1 auto; padding: 1px 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .added { background: #f0fdf4; }
  .added .marker { color: #15803d; }
  .removed { background: #fef2f2; }
  .removed .marker { color: #b91c1c; }
  .same .marker { color: #d1d5db; }
  .empty { color: #4b5563; font-size: 12px; }
</style>
</head>
<body>
  <h1>Comparison report</h1>
  <p class="meta">Left: ${escapeHtml(leftName)} &nbsp;·&nbsp; Right: ${escapeHtml(rightName)}</p>
  <div class="summary">
    <span class="add">${added} added line${added === 1 ? "" : "s"}</span>
    <span class="del">${removed} removed line${removed === 1 ? "" : "s"}</span>
    <span>${rows.length - added - removed} unchanged</span>
  </div>
  <div class="report">
${body}
  </div>
</body>
</html>`;
}
