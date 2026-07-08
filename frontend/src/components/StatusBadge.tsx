import type { ReactNode } from "react";

/**
 * Variant-driven status pill so we don't end up with a different badge
 * component per surface. Add new variants here, not by cloning the component.
 *
 * Color discipline rules (per docs/COLOR_USAGE.md, revised in UX-1):
 *   - Cardinal Red is reserved for `danger` / `rejected` / `needs-revision`
 *     (terminal or error signals). Never for info or active states.
 *   - The accent family (accent-soft fill + accent text) carries
 *     in-flight states: active / submitted / in-review.
 *   - Success and warning states carry their own soft tinted fills
 *     (success-soft / warning-soft) so status reads at a glance —
 *     the pre-UX-1 grey-fill treatment made every state look alike.
 *   - Warm-gray-light + warm-gray-med still carries inactive / archived /
 *     muted (states that should recede).
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
    background: "var(--color-accent-soft)",
    color: "var(--color-accent)",
    borderColor: "var(--color-accent-border)",
  },
  inactive: {
    background: "var(--color-warm-gray-light)",
    color: "var(--fg-2)",
    borderColor: "var(--color-border-strong)",
  },
  system: {
    background: "var(--color-light-blue-soft)",
    color: "var(--fg-1)",
    borderColor: "var(--color-light-blue)",
  },
  neutral: {
    background: "var(--color-warm-gray-light)",
    color: "var(--fg-1)",
    borderColor: "var(--color-border)",
  },
  success: {
    background: "var(--color-success-soft)",
    color: "var(--color-success)",
    borderColor: "var(--color-success-border)",
  },
  warning: {
    background: "var(--color-warning-soft)",
    color: "var(--color-warning)",
    borderColor: "var(--color-warning-border)",
  },
  danger: {
    background: "var(--color-danger-soft)",
    color: "var(--color-cardinal-red)",
    borderColor: "var(--color-danger-border)",
  },
  // Accent family, same as active/submitted — the color says "in flight";
  // the label carries the distinction. (Pre-UX-1 this was grey italic,
  // which read as muted rather than in-progress.)
  "in-review": {
    background: "var(--color-accent-soft)",
    color: "var(--color-accent)",
    borderColor: "var(--color-accent-border)",
  },
  // Green soft fill — the semantic layer added in UX-1 allows tinted
  // fills for terminal-positive states.
  approved: {
    background: "var(--color-success-soft)",
    color: "var(--color-success)",
    borderColor: "var(--color-success-border)",
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
    background: "var(--color-warning-soft)",
    color: "var(--color-warning)",
    borderColor: "var(--color-warning-border)",
  },
  "needs-revision": {
    background: "var(--color-danger-soft)",
    color: "var(--color-cardinal-red)",
    borderColor: "var(--color-danger-border)",
  },
  // Amber tone: action required but the SO is waiting, not rejecting.
  "needs-clarification": {
    background: "var(--color-warning-soft)",
    color: "var(--color-warning)",
    borderColor: "var(--color-warning-border)",
  },
  // Neutral muted: requestor voluntarily pulled back, no urgency signal.
  recalled: {
    background: "var(--color-warm-gray-light)",
    color: "var(--fg-2)",
    borderColor: "var(--color-border-strong)",
  },
  // Amber-tinted: awaiting Revenue Manager action, similar weight to needs-clarification.
  "pricing-review": {
    background: "var(--color-warning-soft)",
    color: "var(--color-warning)",
    borderColor: "var(--color-warning-border)",
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
