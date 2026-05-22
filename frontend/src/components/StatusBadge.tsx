import type { ReactNode } from "react";

/**
 * Variant-driven status pill so we don't end up with a different badge
 * component per surface. Add new variants here, not by cloning the component.
 *
 * Color discipline rules (per docs/COLOR_USAGE.md):
 *   - Cardinal Red is reserved for `danger` (Failed / Inactive Admin / etc.).
 *     It is never used for `info` or `active` states.
 *   - Light Blue (with a soft background) carries info / active / system.
 *   - Warm-gray-light + warm-gray-med carries inactive / archived / muted.
 *   - Success and warning use the muted forest / amber as text/icon color
 *     only — the fill stays warm-gray-light so they don't shout.
 */
export type StatusBadgeVariant =
  | "active"
  | "inactive"
  | "system"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  // Phase 6a: estimate-request workflow states. Draft and Submitted reuse
  // `neutral` and `active` respectively; the three below need their own
  // treatment because the prompt calls for italic / forest-green / outlined
  // Cardinal Red, none of which the original variants give us.
  | "in-review"
  | "approved"
  | "rejected"
  | "partially-approved"
  | "needs-revision"
  | "needs-clarification"
  | "recalled"
  | "pricing-review";

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children: ReactNode;
  /** Optional 12px Lucide icon to the left of the label. */
  icon?: ReactNode;
  /** Override the accessible label (defaults to the rendered text). */
  ariaLabel?: string;
  className?: string;
}

const VARIANT_STYLES: Record<StatusBadgeVariant, React.CSSProperties> = {
  active: {
    background: "var(--color-light-blue-soft)",
    color: "var(--fg-1)",
    borderColor: "rgba(187,221,230,0.7)",
  },
  inactive: {
    background: "var(--color-warm-gray-light)",
    color: "var(--fg-2)",
    borderColor: "var(--color-border-strong)",
  },
  system: {
    background: "rgba(187, 221, 230, 0.45)",
    color: "var(--fg-1)",
    borderColor: "rgba(187,221,230,0.9)",
  },
  neutral: {
    background: "var(--color-warm-gray-light)",
    color: "var(--fg-1)",
    borderColor: "var(--color-border)",
  },
  success: {
    background: "var(--color-warm-gray-light)",
    color: "var(--color-success)",
    borderColor: "var(--color-border-strong)",
  },
  warning: {
    background: "var(--color-warm-gray-light)",
    color: "var(--color-warning)",
    borderColor: "var(--color-border-strong)",
  },
  danger: {
    background: "var(--color-warm-gray-light)",
    color: "var(--color-cardinal-red)",
    borderColor: "rgba(228, 31, 53, 0.35)",
  },
  // Italic to distinguish from Draft/Submitted at a glance — the SO is
  // working on it but no terminal action has happened yet.
  "in-review": {
    background: "var(--color-warm-gray-light)",
    color: "var(--fg-2)",
    borderColor: "var(--color-border-strong)",
    fontStyle: "italic",
  },
  // Forest-green text on Light Blue tint — matches the "approved" reading
  // in /docs/COLOR_USAGE.md (success colour as text only, never as fill).
  approved: {
    background: "var(--color-light-blue-soft)",
    color: "var(--color-success)",
    borderColor: "rgba(187,221,230,0.7)",
  },
  // Outlined (white fill, red border + text). Same shape as the Admin role
  // badge — Cardinal Red is the only acceptable use here per the brand
  // discipline rules: a terminal rejection is the kind of high-stakes
  // signal Cardinal Red is reserved for.
  rejected: {
    background: "#FFFFFF",
    color: "var(--color-cardinal-red)",
    borderColor: "var(--color-cardinal-red)",
  },
  "partially-approved": {
    background: "var(--color-warm-gray-light)",
    color: "var(--color-warning)",
    borderColor: "var(--color-border-strong)",
  },
  "needs-revision": {
    background: "rgba(228, 31, 53, 0.05)",
    color: "var(--color-cardinal-red)",
    borderColor: "rgba(228, 31, 53, 0.3)",
  },
  // Amber tone: action required but the SO is waiting, not rejecting.
  "needs-clarification": {
    background: "rgba(184, 134, 11, 0.07)",
    color: "var(--color-warning)",
    borderColor: "rgba(184, 134, 11, 0.35)",
  },
  // Neutral muted: requestor voluntarily pulled back, no urgency signal.
  recalled: {
    background: "var(--color-warm-gray-light)",
    color: "var(--fg-2)",
    borderColor: "var(--color-border-strong)",
  },
  // Amber-tinted: awaiting Revenue Manager action, similar weight to needs-clarification.
  "pricing-review": {
    background: "rgba(184, 134, 11, 0.07)",
    color: "var(--color-warning)",
    borderColor: "rgba(184, 134, 11, 0.35)",
  },
};

/**
 * Maps an estimate-request status to its display badge variant + label.
 * Centralised here so MyRequestsPage and EstimateDetailPage stay in sync
 * if the labels are ever copy-edited.
 */
export function estimateStatusBadge(status: string): {
  variant: StatusBadgeVariant;
  label: string;
} {
  switch (status) {
    case "DRAFT":     return { variant: "neutral",   label: "Draft" };
    case "SUBMITTED": return { variant: "active",    label: "Submitted" };
    case "IN_REVIEW": return { variant: "in-review", label: "In review" };
    case "APPROVED":           return { variant: "approved",           label: "Approved" };
    case "REJECTED":           return { variant: "rejected",           label: "Rejected" };
    case "PARTIALLY_APPROVED": return { variant: "partially-approved", label: "Partially approved" };
    case "NEEDS_REVISION":        return { variant: "needs-revision",        label: "Needs revision" };
    case "NEEDS_CLARIFICATION":   return { variant: "needs-clarification",   label: "Clarification needed" };
    case "RECALLED":              return { variant: "recalled",              label: "Recalled" };
    case "PRICING_REVIEW":        return { variant: "pricing-review",        label: "Pricing review" };
    default:                      return { variant: "neutral",               label: status };
  }
}

export function StatusBadge({ variant, children, icon, ariaLabel, className = "" }: StatusBadgeProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 ${className}`}
      // Border declared as longhand pieces (width/style/color) rather than
      // the `border:` shorthand. Mixing shorthand with the variant's
      // longhand `borderColor:` triggered a React warning ("Updating a
      // style property during rerender (borderColor) when a conflicting
      // property is set (border)") because shorthand-vs-longhand
      // application order is undefined in CSSOM.
      style={{
        ...VARIANT_STYLES[variant],
        height: 22,
        padding: "0 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        borderWidth: 1,
        borderStyle: "solid",
        whiteSpace: "nowrap",
      }}
      data-variant={variant}
    >
      {icon}
      {children}
    </span>
  );
}
