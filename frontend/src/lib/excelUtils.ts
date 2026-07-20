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
 * A text cell that hyperlinks to A1 of another sheet in the same workbook.
 * Excel applies its own default hyperlink styling on open — no manual cell
 * styling needed.
 */
export function hyperlinkCell(
  text: string,
  targetSheetName: string,
): { t: "s"; v: string; l: { Target: string; Tooltip: string } } {
  return {
    t: "s",
    v: text,
    l: { Target: `#'${targetSheetName}'!A1`, Tooltip: "Open template" },
  };
}
