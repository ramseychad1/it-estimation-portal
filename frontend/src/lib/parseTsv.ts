/**
 * Minimal tab-separated-values parser for spreadsheet pastes. Excel,
 * Google Sheets, and Numbers all put TSV on the clipboard when copying a
 * multi-cell selection. The exact dialects differ in line endings and
 * trailing-newline handling — this parser is permissive about both.
 *
 * Deliberately small: no quoting / escapes / tab-in-cell support. Cell
 * values that don't parse as finite numbers are returned as {@code null}
 * so the caller can decide whether to skip them or zero them out.
 *
 * @returns 2D array of numbers (or null where unparseable). Empty input
 *          → empty array. Single-cell input → 1×1 array.
 */
export function parseTsv(text: string): (number | null)[][] {
  if (!text) return [];
  // Normalise line endings — Sheets uses \n, Excel on Windows uses \r\n,
  // Numbers occasionally emits \r alone.
  const normalised = text.replace(/\r\n?/g, "\n");
  // Drop a single trailing newline (spreadsheets routinely append one).
  const trimmed = normalised.endsWith("\n") ? normalised.slice(0, -1) : normalised;
  if (trimmed === "") return [];

  return trimmed.split("\n").map((line) =>
    line.split("\t").map((cell) => {
      const v = cell.trim();
      if (v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })
  );
}
