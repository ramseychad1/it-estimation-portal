/** Shared helpers for building client-side .xlsx workbooks with SheetJS (`xlsx`). */

/** Creates a formula cell object for SheetJS (no leading "=" in the f string). */
export function fmla(f: string, v = 0): { t: "n"; f: string; v: number } {
  return { t: "n", f, v };
}

/**
 * Builds a valid Excel sheet tab name from a product/sub-feature label.
 * Excel rules: max 31 chars, no /\?*[]: characters, can't start/end with '.
 * If the same base name would appear twice, appends " (N)" to make it unique.
 */
export function buildSheetNames(
  items: Array<{ productName: string; subFeatureName: string | null }>,
): string[] {
  const INVALID = /[/\\?*[\]:]/g;
  const MAX = 31;

  const base = items.map((it) => {
    const raw = it.subFeatureName ?? it.productName;
    return raw.replace(INVALID, "").replace(/^'+|'+$/g, "").trim().slice(0, MAX) || "Sheet";
  });

  // Deduplicate: if two items produce the same base name, append " (2)", " (3)", …
  const seen = new Map<string, number>();
  return base.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const suffix = ` (${count})`;
    return name.slice(0, MAX - suffix.length) + suffix;
  });
}

/** 0-indexed column number → Excel column letter (0→A, 25→Z, 26→AA, …). */
export function colLetter(n: number): string {
  let s = "";
  let i = n;
  while (i >= 0) {
    s = String.fromCharCode((i % 26) + 65) + s;
    i = Math.floor(i / 26) - 1;
  }
  return s;
}

/**
 * A cell that hyperlinks to A1 of another sheet in the same workbook, via a
 * real Excel HYPERLINK() formula rather than a bare cell-level link
 * relationship. This matters: SheetJS Community Edition (the free `xlsx`
 * package used here) silently drops cell styling (`.s`) on write — a bare
 * `.l` relationship is clickable but renders as plain black text, with no
 * way to apply the blue/underline hyperlink look without Pro-only styling
 * support. A HYPERLINK() formula gets Excel's automatic hyperlink styling
 * for free, no manual styling needed, because Excel special-cases it.
 */
export function hyperlinkCell(
  text: string,
  targetSheetName: string,
): { t: "str"; f: string; v: string } {
  const escapedText = text.replace(/"/g, '""');
  return {
    t: "str",
    f: `HYPERLINK("#'${targetSheetName}'!A1","${escapedText}")`,
    v: text,
  };
}
