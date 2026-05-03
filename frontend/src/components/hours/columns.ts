/**
 * Shared column metadata for the estimate-template grid. Order matches the
 * design system's example template (page 6 of the design PDF) — Onshore
 * before Offshore, Low/Med/High within each. Tests and the paste handler
 * rely on this index → key mapping.
 */
export type RowKey =
  | "onshoreLow"
  | "onshoreMed"
  | "onshoreHigh"
  | "offshoreLow"
  | "offshoreMed"
  | "offshoreHigh";

export interface ColumnDef {
  key: RowKey;
  label: string;
  group: "onshore" | "offshore";
}

export const COLUMNS: ColumnDef[] = [
  { key: "onshoreLow",   label: "Onshore L",  group: "onshore" },
  { key: "onshoreMed",   label: "Onshore M",  group: "onshore" },
  { key: "onshoreHigh",  label: "Onshore H",  group: "onshore" },
  { key: "offshoreLow",  label: "Offshore L", group: "offshore" },
  { key: "offshoreMed",  label: "Offshore M", group: "offshore" },
  { key: "offshoreHigh", label: "Offshore H", group: "offshore" },
];

export type RowValues = Record<RowKey, number>;

export const EMPTY_ROW: RowValues = {
  onshoreLow: 0, onshoreMed: 0, onshoreHigh: 0,
  offshoreLow: 0, offshoreMed: 0, offshoreHigh: 0,
};

export function rowSum(values: RowValues): number {
  return COLUMNS.reduce((sum, c) => sum + (values[c.key] ?? 0), 0);
}

/** gridTemplateColumns shared by HoursGrid rows and HoursRow — with cost column. */
export const GRID_COLS = "minmax(180px, 1.2fr) repeat(6, 84px) 80px 100px";
/** Narrow variant used when no rate data is available (no Total $ column). */
export const GRID_COLS_NO_COST = "minmax(180px, 1.2fr) repeat(6, 84px) 80px";

export function fmtHrs(n: number): number {
  return Math.ceil(n);
}

export function fmtCost(n: number): string {
  return "$" + Math.ceil(n).toLocaleString();
}

/**
 * Maps a chosen complexity (LOW/MED/HIGH) to the two {@link RowKey}s that
 * become editable in {@code HoursGrid} reviewer mode — one Onshore column
 * and one Offshore column at the matching complexity. Returns empty when
 * the reviewer hasn't picked a complexity yet (all cells stay read-only).
 *
 * Why two keys, not one: the snapshot row carries L/M/H for both Onshore
 * and Offshore. The chosen complexity selects which column of each group
 * the review tally uses, so both Onshore-{L|M|H} and Offshore-{L|M|H} for
 * the same complexity letter become the editable pair. Per-cell override
 * columns on the backend ({@code onshore_override}, {@code offshore_override})
 * map directly to whichever keys are editable.
 */
export function editableKeysForComplexity(
  complexity: "LOW" | "MED" | "HIGH" | null,
): ReadonlySet<RowKey> {
  if (complexity === "LOW") return new Set<RowKey>(["onshoreLow", "offshoreLow"]);
  if (complexity === "MED") return new Set<RowKey>(["onshoreMed", "offshoreMed"]);
  if (complexity === "HIGH") return new Set<RowKey>(["onshoreHigh", "offshoreHigh"]);
  return new Set<RowKey>();
}
