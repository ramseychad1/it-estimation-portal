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
  | "danger";

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
};

export function StatusBadge({ variant, children, icon, ariaLabel, className = "" }: StatusBadgeProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{
        ...VARIANT_STYLES[variant],
        height: 22,
        padding: "0 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        border: "1px solid transparent",
        whiteSpace: "nowrap",
        ...VARIANT_STYLES[variant],
      }}
      data-variant={variant}
    >
      {icon}
      {children}
    </span>
  );
}
