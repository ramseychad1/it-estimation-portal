import type { ComponentType, SVGProps } from "react";
import { Link } from "react-router-dom";

/**
 * StatCard + QuickLinkTile co-located here because both are tiny
 * dashboard primitives that nothing else needs. Splitting them into
 * separate files would just add import noise.
 *
 * Color discipline: numbers are Near-Black, labels Warm-Gray-Med — never
 * Cardinal Red. The dashboard is informational; Cardinal Red stays
 * reserved for danger / wayfinding (see docs/COLOR_USAGE.md).
 */

interface StatCardProps {
  label: string;
  count: number;
  description?: string | null;
  href?: string;
}

export function StatCard({ label, count, description, href }: StatCardProps) {
  const inner = (
    <div
      data-testid="stat-card"
      className="bg-white"
      style={{
        border: "1px solid var(--color-warm-gray-light)",
        borderRadius: 8,
        padding: 24,
        cursor: href ? "pointer" : undefined,
        transition: href ? "box-shadow 0.15s" : undefined,
      }}
    >
      <div
        className="text-near-black font-semibold tabular-nums"
        style={{ fontSize: 32, lineHeight: 1.1 }}
      >
        {count.toLocaleString()}
      </div>
      <div className="text-warm-gray-med mt-2" style={{ fontSize: 14 }}>
        {label}
      </div>
      {description && (
        <p
          className="m-0 mt-1 text-warm-gray-med"
          style={{ fontSize: 12, fontStyle: "italic" }}
        >
          {description}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="no-underline hover:shadow-sm block">
        {inner}
      </Link>
    );
  }
  return inner;
}

interface QuickLinkTileProps {
  title: string;
  description: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export function QuickLinkTile({
  title,
  description,
  to,
  icon: Icon,
}: QuickLinkTileProps) {
  return (
    <Link
      to={to}
      data-testid="quick-link-tile"
      className="bg-white text-near-black no-underline transition-shadow hover:shadow-sm"
      style={{
        border: "1px solid var(--color-warm-gray-light)",
        borderRadius: 8,
        padding: 16,
        display: "block",
      }}
    >
      <Icon
        className="text-near-black"
        style={{ width: 24, height: 24 }}
        strokeWidth={1.5}
      />
      <div
        className="mt-2 font-semibold text-near-black"
        style={{ fontSize: 14 }}
      >
        {title}
      </div>
      <p
        className="m-0 mt-1 text-warm-gray-med"
        style={{
          fontSize: 12,
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
        }}
      >
        {description}
      </p>
    </Link>
  );
}
