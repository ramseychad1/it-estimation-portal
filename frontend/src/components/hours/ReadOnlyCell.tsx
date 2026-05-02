import type { ReactNode } from "react";

interface ReadOnlyCellProps {
  value: number;
  ariaLabel: string;
  /**
   * Visual treatment hint:
   *   - "dimmed"   — Warm-Gray-Med text on Warm-Gray-Light bg (the
   *                  non-chosen complexity columns in reviewer mode)
   *   - "active"   — Near-Black text on white bg (a chosen-complexity
   *                  column in reviewer mode that the reviewer hasn't
   *                  picked complexity for yet OR a phase row that the
   *                  consumer wants visible-but-unchangeable)
   */
  appearance?: "dimmed" | "active";
  /** Tooltip shown on hover (e.g. "Original: 12" when an override is in play). */
  title?: string;
  /** Optional overlay rendered on top of the value (e.g. an override marker). */
  overlay?: ReactNode;
}

/**
 * Non-interactive sibling of {@link HoursCell} for reviewer mode's
 * non-chosen complexity columns. Same 84px width + 28px height + right-
 * aligned tabular-nums layout, so the grid stays visually aligned whether
 * a column is editable or read-only.
 *
 * Phase 6b only renders this in reviewer mode; template-editor mode keeps
 * using {@link HoursCell} for every cell.
 */
export function ReadOnlyCell({
  value,
  ariaLabel,
  appearance = "dimmed",
  title,
  overlay,
}: ReadOnlyCellProps) {
  const dimmed = appearance === "dimmed";
  return (
    <div
      className="flex flex-col"
      style={{ width: 84, position: "relative" }}
    >
      <span
        role="cell"
        aria-label={ariaLabel}
        title={title}
        className="tabular-nums w-full"
        style={{
          height: 28,
          padding: "0 8px",
          textAlign: "right",
          borderRadius: 4,
          border: "1px solid var(--color-border)",
          background: dimmed ? "var(--color-warm-gray-light)" : "var(--color-white)",
          color: dimmed ? "var(--color-warm-gray-med)" : "var(--color-near-black)",
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "flex-end",
          userSelect: "text",
        }}
      >
        {formatNumber(value)}
      </span>
      {overlay}
    </div>
  );
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}
