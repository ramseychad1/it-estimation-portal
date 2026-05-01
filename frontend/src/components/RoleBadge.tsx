import type { CSSProperties } from "react";

/**
 * Variant per canonical role. Admin is the only role with a brand-color
 * treatment (Cardinal Red outlined) — everything else uses the muted
 * palette so role badges don't compete with the rest of the UI.
 */
type Role = "Admin" | "Solution Owner" | "Estimator" | "Requester";

interface RoleBadgeProps {
  role: string;
  /** Optional override styling. */
  className?: string;
}

const STYLES: Record<Role, CSSProperties> = {
  Admin: {
    background: "var(--color-white)",
    color: "var(--color-cardinal-red)",
    border: "1px solid var(--color-cardinal-red)",
  },
  "Solution Owner": {
    background: "var(--color-light-blue-soft)",
    color: "var(--fg-1)",
    border: "1px solid rgba(187,221,230,0.7)",
  },
  Estimator: {
    background: "var(--color-warm-gray-light)",
    color: "var(--fg-1)",
    border: "1px solid var(--color-border)",
  },
  Requester: {
    background: "var(--color-warm-gray-light)",
    color: "var(--fg-2)",
    border: "1px solid var(--color-border)",
  },
};

export function RoleBadge({ role, className = "" }: RoleBadgeProps) {
  const variant = (STYLES as Record<string, CSSProperties>)[role] ?? STYLES.Estimator;
  return (
    <span
      className={`inline-flex items-center font-medium ${className}`}
      style={{
        ...variant,
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
      data-role={role}
    >
      {role}
    </span>
  );
}
