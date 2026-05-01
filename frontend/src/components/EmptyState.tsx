import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  /** Body copy. Constrained to ~380px max-width so the line length stays comfortable. */
  description?: string;
  /** Optional action element (typically a Primary or Secondary button). */
  action?: ReactNode;
  /**
   * "card" — full-width card with thicker padding for the new-workspace
   *          variant (no rows yet). Default.
   * "inline" — tighter padding when the empty state lives inside another
   *            container (e.g., the filtered-to-zero state inside a
   *            populated list area). The inline variant intentionally
   *            keeps the same title/description sizing as the card
   *            variant — the only difference is vertical padding.
   */
  variant?: "card" | "inline";
}

/**
 * Title is 18px semibold, description is 14px Warm-Gray-Med constrained to
 * 380px width — matches the existing inline empty-state convention used by
 * Phase 2-3 pages (TeamsPage, SdlcPhasesPage). Empty states are meant to
 * feel like quiet but distinct moments; smaller titles read as body text.
 *
 * Variants only differ in vertical padding: {@code card} is 80px (full
 * page-level state), {@code inline} is 32px (lives inside another section
 * card so it doesn't need the extra breathing room).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "card",
}: EmptyStateProps) {
  const padY = variant === "card" ? 80 : 32;
  return (
    <div
      className="text-center rounded-lg"
      style={{
        padding: `${padY}px 24px`,
        background: "#FBFBFA",
        border: "1px dashed var(--color-border-strong)",
      }}
    >
      {Icon && (
        <Icon
          className="mx-auto mb-3 text-warm-gray-med"
          style={{ width: 32, height: 32 }}
          strokeWidth={1.5}
        />
      )}
      <p
        className="m-0 text-near-black font-semibold"
        style={{ fontSize: 18 }}
      >
        {title}
      </p>
      {description && (
        <p
          className="m-0 mt-2 text-warm-gray-med"
          style={{
            fontSize: 14,
            maxWidth: 380,
            marginInline: "auto",
          }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
