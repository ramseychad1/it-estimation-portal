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

/**
 * Target-Margin multiplier and Target Margin % are two ways of writing the
 * SAME markup — `multiplier = 1 / (1 − margin%/100)`. The pricing UIs bind the
 * two inputs so editing one derives the other; these helpers are the single
 * source of truth for that conversion (and the badge's margin display).
 */

/**
 * Margin % → equivalent multiplier, rounded to 4dp (the `tm_multiplier` column
 * precision). Returns null for input outside `[0, 100)` — a margin of 100 would
 * divide by zero and a negative margin isn't a markup — so a linked field can
 * simply blank its mirror instead of showing a nonsense value.
 */
export function multiplierFromMarginPct(marginPct: number): number | null {
  if (!Number.isFinite(marginPct) || marginPct < 0 || marginPct >= 100) return null;
  return Math.round((1 / (1 - marginPct / 100)) * 10000) / 10000;
}

/**
 * Multiplier → equivalent margin %, rounded to 2dp (the `tm_target_margin_pct`
 * column precision). Returns null for a multiplier below 1 (that implies a zero
 * or negative margin, i.e. no markup) or non-finite input.
 */
export function marginPctFromMultiplier(multiplier: number): number | null {
  if (!Number.isFinite(multiplier) || multiplier < 1) return null;
  return Math.round((1 - 1 / multiplier) * 100 * 100) / 100;
}

/**
 * Effective gross margin % implied by an internal cost and the resulting client
 * price — `(1 − cost/price) × 100`, rounded to 2dp — regardless of which pricing
 * model produced the price. This is what lets one badge show a real margin for
 * Time & Materials as well as Target Margin. Returns null when an input is
 * missing/non-finite or the price is ≤ 0 (no meaningful margin).
 */
export function effectiveMarginPct(
  internalCost: number | null | undefined,
  clientPrice: number | null | undefined,
): number | null {
  if (internalCost == null || clientPrice == null) return null;
  if (!Number.isFinite(internalCost) || !Number.isFinite(clientPrice)) return null;
  if (clientPrice <= 0) return null;
  return Math.round((1 - internalCost / clientPrice) * 100 * 100) / 100;
}

/**
 * Formats a margin % for compact display (badges, stats, exports): at most one
 * decimal, trailing ".0" trimmed, with a trailing "%". Returns null for
 * missing/non-finite input so callers can omit the margin entirely. A negative
 * margin (price below cost) formats with a leading "-".
 */
export function formatMarginPct(marginPct: number | null | undefined): string | null {
  if (marginPct == null || !Number.isFinite(marginPct)) return null;
  const rounded = Math.round(marginPct * 10) / 10;
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${body}%`;
}

/**
 * Given a raw string typed into ONE of the linked Target-Margin inputs, returns
 * the string values for BOTH fields. The edited field keeps the user's raw text
 * verbatim (so in-progress typing like "1." isn't reformatted); the mirror is
 * derived, or blank when the value is empty, non-numeric, or out of range.
 * Clearing either field clears both — they represent a single value.
 */
export function linkedTmField(
  edited: "multiplier" | "margin",
  rawValue: string,
): { multiplier: string; targetMarginPct: string } {
  if (rawValue.trim() === "") return { multiplier: "", targetMarginPct: "" };
  const n = parseFloat(rawValue);
  if (isNaN(n)) {
    return edited === "multiplier"
      ? { multiplier: rawValue, targetMarginPct: "" }
      : { multiplier: "", targetMarginPct: rawValue };
  }
  if (edited === "multiplier") {
    const m = marginPctFromMultiplier(n);
    return { multiplier: rawValue, targetMarginPct: m != null ? String(m) : "" };
  }
  const mult = multiplierFromMarginPct(n);
  return { multiplier: mult != null ? String(mult) : "", targetMarginPct: rawValue };
}

/** Human-readable label for a pricing model code. */
export function pricingModelLabel(model: string | null | undefined): string {
  if (model === "TARGET_MARGIN") return "Target Margin";
  if (model === "TIME_AND_MATERIALS") return "Time & Materials";
  return "Unassigned";
}

/**
 * Returns a compact label describing the RM's item-level pricing adjustment,
 * or null when no RM override has been applied to the item.
 *
 * Used in the requestor's approved-estimate table and the Excel export.
 * NOT used in the PDF export.
 */
export function rmAdjustmentLabel(item: {
  rmPricingModel?: string | null;
  pricingModel?: string | null;
  rmTmMultiplier?: number | null;
  rmTmTargetMarginPct?: number | null;
  rmMatBillableRate?: number | null;
  rmMatDiscountPct?: number | null;
}): string | null {
  const hasOverride =
    item.rmPricingModel != null ||
    item.rmTmMultiplier != null ||
    item.rmTmTargetMarginPct != null ||
    item.rmMatBillableRate != null ||
    item.rmMatDiscountPct != null;
  if (!hasOverride) return null;

  const model = item.rmPricingModel ?? item.pricingModel;

  if (model === "TIME_AND_MATERIALS") {
    const parts: string[] = [];
    if (item.rmMatBillableRate != null) parts.push(`$${item.rmMatBillableRate}/hr`);
    if (item.rmMatDiscountPct != null) parts.push(`${item.rmMatDiscountPct}% disc.`);
    return parts.length > 0 ? parts.join(" · ") : "T&M override";
  }
  if (model === "TARGET_MARGIN") {
    if (item.rmTmMultiplier != null) return `${item.rmTmMultiplier}× mult.`;
    if (item.rmTmTargetMarginPct != null) return `${item.rmTmTargetMarginPct}% margin`;
    return "Margin override";
  }
  return "RM override";
}
