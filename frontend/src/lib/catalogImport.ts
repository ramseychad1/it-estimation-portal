import { listPhases } from "./api/phases";
import { getSubFeatureTemplate, type SaveTemplateLineInput } from "./api/templates";

const TIER_ROWS = { LOW: 6, MED: 7, HIGH: 8 } as const; // 1-indexed Excel rows
const PHASE_HEADER_ROW = 5; // 1-indexed
const SUMMARY_HEADER_ROW = 3; // 1-indexed
const SUMMARY_DATA_START_ROW = 4; // 1-indexed

const HOUR_FIELDS = [
  "onshoreLow", "onshoreMed", "onshoreHigh",
  "offshoreLow", "offshoreMed", "offshoreHigh",
] as const;
type HourField = (typeof HOUR_FIELDS)[number];

export interface ParsedItem {
  subFeatureId: number;
  containerName: string;
  subFeatureName: string;
  lines: SaveTemplateLineInput[];
}

export interface CellDiff {
  phaseName: string;
  field: HourField;
  oldValue: number;
  newValue: number;
}

export type ItemDiffStatus = "changed" | "unchanged" | "missing" | "invalid";

export interface DiffedItem {
  subFeatureId: number;
  containerName: string;
  subFeatureName: string;
  status: ItemDiffStatus;
  cellDiffs: CellDiff[];
  invalidReasons: string[];
  lines: SaveTemplateLineInput[];
}

export interface CatalogDiff {
  items: DiffedItem[];
  changedCount: number;
  unchangedCount: number;
  missingCount: number;
  invalidCount: number;
}

const FIELD_LABEL: Record<HourField, string> = {
  onshoreLow: "Onshore Low", onshoreMed: "Onshore Med", onshoreHigh: "Onshore High",
  offshoreLow: "Offshore Low", offshoreMed: "Offshore Med", offshoreHigh: "Offshore High",
};

function row(sheetAoa: unknown[][], excelRow: number): unknown[] {
  return sheetAoa[excelRow - 1] ?? [];
}

function cellNum(r: unknown[], col: number): number {
  const v = r[col];
  return typeof v === "number" ? v : Number(v);
}

/**
 * Reads an uploaded catalog export back into per-SubFeature line sets ready
 * to submit to `saveSubFeatureTemplate`. Assumes the file's structure
 * matches what `buildCatalogExcel` produces — this only round-trips its own
 * export, it's not a general-purpose importer. Throws with a user-facing
 * message on structural mismatches (wrong file, phase set changed since
 * export) rather than silently misaligning columns.
 */
export async function parseCatalogWorkbook(file: File): Promise<ParsedItem[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });

  const summaryWs = wb.Sheets["Summary"];
  if (!summaryWs) {
    throw new Error("This doesn't look like a catalog export — no \"Summary\" tab found.");
  }
  const summaryAoa = XLSX.utils.sheet_to_json<unknown[]>(summaryWs, { header: 1, raw: true, defval: null });

  const headerRow = summaryAoa[SUMMARY_HEADER_ROW - 1] ?? [];
  const idCol = headerRow.indexOf("SubFeature ID");
  const sheetNameCol = headerRow.indexOf("Sheet Name");
  const containerCol = headerRow.indexOf("Container");
  const subFeatureCol = 1; // "Sub-Product" — hyperlink formula cell, but sheet_to_json returns its cached display text
  if (idCol < 0 || sheetNameCol < 0) {
    throw new Error(
      "This file is missing its round-trip metadata columns — it may have been exported by an older version of Export Catalog. Re-export a fresh copy.",
    );
  }

  const phases = [...(await listPhases("ACTIVE"))].sort((a, b) => a.displayOrder - b.displayOrder);
  const phaseCount = phases.length;

  const rows = summaryAoa.slice(SUMMARY_DATA_START_ROW - 1).filter((r) => r && r[idCol] != null);

  const items: ParsedItem[] = [];
  let phaseNamesChecked = false;

  for (const r of rows) {
    const subFeatureId = Number(r[idCol]);
    const sheetName = String(r[sheetNameCol]);
    const containerName = containerCol >= 0 ? String(r[containerCol] ?? "") : "";
    const subFeatureName = typeof r[subFeatureCol] === "string" ? (r[subFeatureCol] as string) : sheetName;

    const itemWs = wb.Sheets[sheetName];
    if (!itemWs) {
      throw new Error(`Tab "${sheetName}" referenced by the Summary tab is missing from this file.`);
    }
    const itemAoa = XLSX.utils.sheet_to_json<unknown[]>(itemWs, { header: 1, raw: true, defval: null });

    const headerRowVals = row(itemAoa, PHASE_HEADER_ROW);
    const onshoreStart = 1;
    const fileOnshorePhaseNames = phases.map((_, j) => String(headerRowVals[onshoreStart + j] ?? ""));

    if (!phaseNamesChecked) {
      const currentNames = phases.map((p) => p.name);
      const matches =
        fileOnshorePhaseNames.length === currentNames.length
        && fileOnshorePhaseNames.every((n, j) => n === currentNames[j]);
      if (!matches) {
        throw new Error(
          `This file's SDLC phases (${fileOnshorePhaseNames.join(", ")}) don't match the app's current phases `
          + `(${currentNames.join(", ")}). The phase list must have changed since this file was exported — `
          + "re-export a fresh copy before importing.",
        );
      }
      phaseNamesChecked = true;
    }

    const lowRow = row(itemAoa, TIER_ROWS.LOW);
    const medRow = row(itemAoa, TIER_ROWS.MED);
    const highRow = row(itemAoa, TIER_ROWS.HIGH);
    const offshoreStart = 1 + phaseCount;

    const lines: SaveTemplateLineInput[] = phases.map((phase, j) => ({
      sdlcPhaseId: phase.id,
      onshoreLow: cellNum(lowRow, onshoreStart + j),
      onshoreMed: cellNum(medRow, onshoreStart + j),
      onshoreHigh: cellNum(highRow, onshoreStart + j),
      offshoreLow: cellNum(lowRow, offshoreStart + j),
      offshoreMed: cellNum(medRow, offshoreStart + j),
      offshoreHigh: cellNum(highRow, offshoreStart + j),
    }));

    items.push({ subFeatureId, containerName, subFeatureName, lines });
  }

  return items;
}

function boundsError(v: number): string | null {
  if (!Number.isFinite(v)) return "not a number";
  if (v < 0) return "must be ≥ 0";
  if (v > 99999.99) return "must be ≤ 99999.99";
  return null;
}

/**
 * Fetches each parsed SubFeature's current live template and classifies the
 * change. Reuses `getSubFeatureTemplate` (the same call the template editor
 * makes) rather than any new endpoint.
 */
export async function diffAgainstLive(parsed: ParsedItem[]): Promise<CatalogDiff> {
  const live = await Promise.all(
    parsed.map(async (p) => {
      try {
        return await getSubFeatureTemplate(p.subFeatureId);
      } catch {
        return null; // deleted, or any other fetch failure — treated as "missing", see below
      }
    }),
  );

  const items: DiffedItem[] = parsed.map((p, i) => {
    const liveTemplate = live[i];

    if (liveTemplate == null) {
      return {
        subFeatureId: p.subFeatureId, containerName: p.containerName, subFeatureName: p.subFeatureName,
        status: "missing", cellDiffs: [], invalidReasons: [], lines: p.lines,
      };
    }

    const invalidReasons: string[] = [];
    for (const line of p.lines) {
      const phaseName = liveTemplate.lines.find((l) => l.sdlcPhaseId === line.sdlcPhaseId)?.sdlcPhaseName ?? `phase ${line.sdlcPhaseId}`;
      for (const field of HOUR_FIELDS) {
        const err = boundsError(line[field]);
        if (err) invalidReasons.push(`${phaseName} ${FIELD_LABEL[field]}: ${err}`);
      }
    }
    if (invalidReasons.length > 0) {
      return {
        subFeatureId: p.subFeatureId, containerName: p.containerName, subFeatureName: p.subFeatureName,
        status: "invalid", cellDiffs: [], invalidReasons, lines: p.lines,
      };
    }

    const liveByPhase = new Map(liveTemplate.lines.map((l) => [l.sdlcPhaseId, l]));
    const cellDiffs: CellDiff[] = [];
    for (const line of p.lines) {
      const liveLine = liveByPhase.get(line.sdlcPhaseId);
      if (!liveLine) continue; // shouldn't happen — phase-set check in parseCatalogWorkbook already guards this
      for (const field of HOUR_FIELDS) {
        const oldValue = liveLine[field];
        const newValue = line[field];
        if (Math.abs(oldValue - newValue) > 0.001) {
          cellDiffs.push({ phaseName: liveLine.sdlcPhaseName, field, oldValue, newValue });
        }
      }
    }

    return {
      subFeatureId: p.subFeatureId, containerName: p.containerName, subFeatureName: p.subFeatureName,
      status: cellDiffs.length > 0 ? "changed" : "unchanged",
      cellDiffs, invalidReasons: [], lines: p.lines,
    };
  });

  return {
    items,
    changedCount: items.filter((i) => i.status === "changed").length,
    unchangedCount: items.filter((i) => i.status === "unchanged").length,
    missingCount: items.filter((i) => i.status === "missing").length,
    invalidCount: items.filter((i) => i.status === "invalid").length,
  };
}
