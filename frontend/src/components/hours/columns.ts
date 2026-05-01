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
