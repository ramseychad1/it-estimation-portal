import type {
  Complexity,
  EstimateRequestPhaseLineView,
} from "./api/estimates";

/**
 * The Onshore + Offshore values to display for a single phase line at a
 * given complexity, with overrides applied.
 *
 * <p>Override semantics: {@code onshoreOverride} replaces the chosen
 * complexity's onshore column when non-null; same for offshore. Other
 * columns are unaffected — the override is per-Onshore/Offshore, not
 * per-L/M/H. The chosen complexity selects which column the override
 * applies to.
 */
export interface DisplayedRow {
  onshore: number;
  offshore: number;
  onshoreOverridden: boolean;
  offshoreOverridden: boolean;
}

/**
 * Pulls the Onshore + Offshore display values for a phase line at the
 * given complexity, applying any overrides. Returns 0/0 when complexity
 * is null (no column picked).
 */
export function displayedRow(
  line: EstimateRequestPhaseLineView,
  complexity: Complexity | null,
): DisplayedRow {
  if (!complexity) {
    return { onshore: 0, offshore: 0, onshoreOverridden: false, offshoreOverridden: false };
  }
  const onsSnapshot =
    complexity === "LOW" ? line.onshoreLow
      : complexity === "MED" ? line.onshoreMed
      : line.onshoreHigh;
  const offsSnapshot =
    complexity === "LOW" ? line.offshoreLow
      : complexity === "MED" ? line.offshoreMed
      : line.offshoreHigh;
  return {
    onshore: line.onshoreOverride ?? onsSnapshot,
    offshore: line.offshoreOverride ?? offsSnapshot,
    onshoreOverridden: line.onshoreOverride != null,
    offshoreOverridden: line.offshoreOverride != null,
  };
}

/**
 * Sum of onshore + offshore hours across every phase line at the chosen
 * complexity, applying overrides. Null complexity → 0.
 */
export function totalHoursForLines(
  lines: EstimateRequestPhaseLineView[],
  complexity: Complexity | null,
): number {
  if (!complexity) return 0;
  let sum = 0;
  for (const line of lines) {
    const d = displayedRow(line, complexity);
    sum += d.onshore + d.offshore;
  }
  return sum;
}

/**
 * Total cost = (sum of chosen-column onshore hours × onshore rate) +
 * (sum of chosen-column offshore hours × offshore rate). Rate values
 * arrive as strings from the API to preserve BigDecimal precision; we
 * Number-cast at the call boundary because final display rounds anyway.
 */
export function totalCostForLines(
  lines: EstimateRequestPhaseLineView[],
  complexity: Complexity | null,
  rate: { onshoreRate: string; offshoreRate: string } | null,
): number {
  if (!complexity || !rate) return 0;
  let onsHrs = 0;
  let offsHrs = 0;
  for (const line of lines) {
    const d = displayedRow(line, complexity);
    onsHrs += d.onshore;
    offsHrs += d.offshore;
  }
  return onsHrs * Number(rate.onshoreRate) + offsHrs * Number(rate.offshoreRate);
}

/**
 * Sum of chosen-column onshore hours (with overrides). Used for the
 * cost-breakdown display ("Onshore total: {hrs} × ${rate} = ${cost}").
 */
export function onshoreHoursForLines(
  lines: EstimateRequestPhaseLineView[],
  complexity: Complexity | null,
): number {
  if (!complexity) return 0;
  return lines.reduce((sum, line) => sum + displayedRow(line, complexity).onshore, 0);
}

/**
 * Sum of chosen-column offshore hours (with overrides).
 */
export function offshoreHoursForLines(
  lines: EstimateRequestPhaseLineView[],
  complexity: Complexity | null,
): number {
  if (!complexity) return 0;
  return lines.reduce((sum, line) => sum + displayedRow(line, complexity).offshore, 0);
}

/**
 * Computes the client-facing price from effective pricing parameters.
 *
 * TARGET_MARGIN: uses multiplier if set, otherwise falls back to margin %.
 * TIME_AND_MATERIALS: total hours × billable rate × (1 − discount%).
 *
 * Returns null when the model is unset or required inputs are missing.
 */
export function computeClientPrice(
  pricingModel: string | null | undefined,
  internalCost: number | null,
  totalHours: number,
  tmMultiplier: number | null | undefined,
  tmTargetMarginPct: number | null | undefined,
  matBillableRate: number | null | undefined,
  matDiscountPct: number | null | undefined,
): number | null {
  if (!pricingModel) return null;
  if (pricingModel === "TARGET_MARGIN") {
    if (internalCost == null) return null;
    if (tmMultiplier != null) return internalCost * tmMultiplier;
    if (tmTargetMarginPct != null && tmTargetMarginPct < 100) {
      return internalCost / (1 - tmTargetMarginPct / 100);
    }
    return null;
  }
  if (pricingModel === "TIME_AND_MATERIALS") {
    if (matBillableRate == null) return null;
    const discount = matDiscountPct ?? 0;
    return totalHours * matBillableRate * (1 - discount / 100);
  }
  return null;
}

/** Human-readable label for a pricing model code. */
export function pricingModelLabel(model: string | null | undefined): string {
  if (model === "TARGET_MARGIN") return "Target Margin";
  if (model === "TIME_AND_MATERIALS") return "Time & Materials";
  return "Unassigned";
}
