import { effectiveMarginPct, formatMarginPct, pricingModelLabel } from "../lib/estimateMath";

/**
 * Compact, neutral chip that shows how an item was priced — the pricing MODEL
 * (Target Margin / Time & Materials / Unassigned) and the resulting MARGIN % —
 * so the pricing basis reads the same on every internal surface.
 *
 * Intentionally NOT a {@link StatusBadge}: this is informational metadata, not a
 * workflow status, so it uses the muted warm-gray treatment and no
 * `role="status"`. A NEGATIVE margin (client price below internal cost) flips to
 * the warning tone — a real caution worth surfacing, per the semantic palette.
 *
 * Never render this on the client-facing PDF: it exposes internal margin.
 *
 * Pass either a pre-computed `marginPct`, or `internalCost` + `clientPrice` and
 * the badge derives the effective margin itself.
 */
export function PricingBasisBadge({
  model,
  marginPct,
  internalCost,
  clientPrice,
  className = "",
}: {
  model: string | null | undefined;
  marginPct?: number | null;
  internalCost?: number | null;
  clientPrice?: number | null;
  className?: string;
}) {
  const margin = marginPct ?? effectiveMarginPct(internalCost, clientPrice);
  const marginText = formatMarginPct(margin);
  const negative = margin != null && margin < 0;

  const tone = negative
    ? {
        background: "var(--color-warning-soft)",
        color: "var(--color-warning)",
        borderColor: "var(--color-warning-border)",
      }
    : {
        background: "var(--color-warm-gray-light)",
        color: "var(--fg-1)",
        borderColor: "var(--color-border)",
      };

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={
        marginText
          ? `${pricingModelLabel(model)} · ${marginText} margin`
          : pricingModelLabel(model)
      }
      // Longhand border pieces (not `border:` shorthand) to avoid the
      // shorthand-vs-longhand CSSOM warning, matching StatusBadge.
      style={{
        ...tone,
        height: 22,
        padding: "0 8px",
        borderRadius: 4,
        borderWidth: 1,
        borderStyle: "solid",
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      {pricingModelLabel(model)}
      {marginText && (
        <span className="tabular-nums" style={{ opacity: negative ? 1 : 0.7 }}>
          · {marginText} margin
        </span>
      )}
    </span>
  );
}
