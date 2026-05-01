import type { ReactNode } from "react";
import { PageHeader, type BreadcrumbItem } from "./PageHeader";
import { UserCell } from "./UserCell";

interface EntityHeaderProps {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  /** Inline element to the right of the title — typically a {@code <StatusBadge>}. */
  titleSuffix?: ReactNode;
  /** Rich subtitle row (e.g. mode pill + description). */
  subtitle?: ReactNode;
  /** Right-aligned actions (kebab + optional inline button). */
  actions?: ReactNode;
  /** Audit footer slot. Pass {@code <EntityHeader.AuditFooter ...>} or null to suppress. */
  auditFooter?: ReactNode;
}

/**
 * Detail-page header. Wraps {@link PageHeader} for breadcrumb + title +
 * subtitle + actions, then layers an audit footer beneath. The footer
 * shape is identical to the drawer audit footers used in Phases 2-3, so
 * the same {@code AuditFooter} subcomponent serves both.
 *
 * The wrap (rather than a parallel header) keeps PageHeader as the single
 * source of truth for type scale, breadcrumb styling, and action-slot
 * spacing — any future PageHeader tweak flows through.
 */
export function EntityHeader({
  breadcrumb,
  title,
  titleSuffix,
  subtitle,
  actions,
  auditFooter,
}: EntityHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={breadcrumb}
        title={title}
        titleSuffix={titleSuffix}
        subtitleNode={subtitle}
        actions={actions}
      />
      {auditFooter}
    </header>
  );
}

interface AuditFooterProps {
  createdAt: string | null;
  createdBy: number | null;
  updatedAt: string | null;
  updatedBy: number | null;
  onViewHistory?: () => void;
}

/**
 * Created/updated metadata + "View change history →" link. Same shape as
 * the drawer audit footer pattern from Phases 2-3.
 */
function AuditFooter({
  createdAt,
  createdBy,
  updatedAt,
  updatedBy,
  onViewHistory,
}: AuditFooterProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2"
      style={{ fontSize: 12, color: "var(--color-warm-gray-med)" }}
    >
      <Field label="Created">
        <UserCell userId={createdBy} size={18} />
        {createdAt && <span>· {formatTimestamp(createdAt)}</span>}
      </Field>
      <Field label="Updated">
        <UserCell userId={updatedBy} size={18} />
        {updatedAt && <span>· {formatTimestamp(updatedAt)}</span>}
      </Field>
      {onViewHistory && (
        <button
          type="button"
          onClick={onViewHistory}
          className="text-near-black bg-transparent border-0 cursor-pointer hover:underline"
          style={{ fontSize: 12 }}
        >
          View change history →
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="uppercase font-medium" style={{ fontSize: 11, letterSpacing: "0.04em" }}>
        {label}
      </span>
      {children}
    </span>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

EntityHeader.AuditFooter = AuditFooter;
