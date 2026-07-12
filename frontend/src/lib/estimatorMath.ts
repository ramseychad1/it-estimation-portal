import type { RowValues } from "../components/hours/columns";

/**
 * Dev-hours benchmark estimator (from the "SDLC Estimator" workbook).
 *
 * The model anchors on development effort: the dev-anchor phase's Mid % is
 * the divisor that back-solves total project hours from entered dev hours,
 * contingency inflates the whole project, then each phase's Mid % distributes
 * the total. Each phase splits into onshore/offshore by its own offshore %.
 *
 * All percentages are fractions (0.35 = 35%). This mirrors the template grid's
 * six cells per phase (onshore/offshore × Low/Mid/High) — the three dev-hour
 * inputs (Low/Likely/High complexity) each flow through the same distribution.
 *
 * Pure and client-side by design: the server just stores the resulting hours,
 * exactly as it does for hand-entered templates. Phase D's reviewer estimate
 * reuses this same function.
 */

export interface EstimatorPhaseInput {
  phaseId: number;
  /** Phase's share of the project (fraction). null = no benchmark → skipped. */
  midPct: number | null;
  /** Offshore split for this phase (fraction, 0..1). */
  offshorePct: number;
  isAnchor: boolean;
}

export interface EstimatorInputs {
  devLow: number;
  devMid: number;
  devHigh: number;
  /** Contingency uplift applied to the whole project (fraction, e.g. 0.10). */
  contingencyPct: number;
  phases: EstimatorPhaseInput[];
}

export interface EstimatorResult {
  /** phaseId → six computed cells. Only phases with a Mid % are included. */
  values: Map<number, RowValues>;
  /** Total project hours per complexity (sum of all cells), with contingency. */
  totals: { low: number; mid: number; high: number };
  anchorMidPct: number | null;
  /** false when there's no usable anchor (missing or Mid % ≤ 0) — nothing computed. */
  ok: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export function computeEstimate(inputs: EstimatorInputs): EstimatorResult {
  const anchor = inputs.phases.find((p) => p.isAnchor);
  const anchorMid = anchor?.midPct ?? null;
  const values = new Map<number, RowValues>();

  if (anchorMid === null || anchorMid <= 0) {
    return { values, totals: { low: 0, mid: 0, high: 0 }, anchorMidPct: anchorMid, ok: false };
  }

  const uplift = 1 + (inputs.contingencyPct || 0);
  const totalFor = (dev: number) => (dev / anchorMid) * uplift;
  const totals = { low: 0, mid: 0, high: 0 };

  for (const p of inputs.phases) {
    if (p.midPct === null) continue; // no benchmark — leave that grid row untouched
    const mid = p.midPct;
    const off = clamp01(p.offshorePct);
    const cell = (dev: number, offshore: boolean) => {
      const phaseHrs = totalFor(dev) * mid;
      return round1(phaseHrs * (offshore ? off : 1 - off));
    };
    const row: RowValues = {
      onshoreLow: cell(inputs.devLow, false),
      onshoreMed: cell(inputs.devMid, false),
      onshoreHigh: cell(inputs.devHigh, false),
      offshoreLow: cell(inputs.devLow, true),
      offshoreMed: cell(inputs.devMid, true),
      offshoreHigh: cell(inputs.devHigh, true),
    };
    values.set(p.phaseId, row);
    totals.low += row.onshoreLow + row.offshoreLow;
    totals.mid += row.onshoreMed + row.offshoreMed;
    totals.high += row.onshoreHigh + row.offshoreHigh;
  }

  return {
    values,
    totals: { low: round1(totals.low), mid: round1(totals.mid), high: round1(totals.high) },
    anchorMidPct: anchorMid,
    ok: true,
  };
}
