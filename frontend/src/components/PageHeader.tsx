import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  /** Optional inline element rendered to the right of the title (e.g. a status badge). */
  titleSuffix?: ReactNode;
  /** Optional rich subtitle. Falls back to {@code subtitle} string when not set. */
  subtitleNode?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ breadcrumb, title, titleSuffix, subtitle, subtitleNode, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 text-small text-warm-gray-med" aria-label="Breadcrumb">
          {breadcrumb.map((item, idx) => {
            const isLast = idx === breadcrumb.length - 1;
            return (
              <span key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
                {item.to && !isLast ? (
                  <Link to={item.to} className="text-warm-gray-med hover:text-near-black hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-near-black font-medium" : "text-warm-gray-med"}>
                    {item.label}
                  </span>
                )}
                {!isLast && <span className="text-warm-gray-med/60">/</span>}
              </span>
            );
          })}
        </nav>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-page-title font-semibold text-near-black tracking-tight m-0">
              {title}
            </h1>
            {titleSuffix}
          </div>
          {subtitleNode ? (
            <div className="text-body text-warm-gray-med mt-0.5">{subtitleNode}</div>
          ) : subtitle ? (
            <p className="text-body text-warm-gray-med mt-0.5">{subtitle}</p>
          ) : null}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function ComingSoon({ message = "Coming soon." }: { message?: string }) {
  return (
    <div
      className="rounded-lg border-dashed border text-center text-warm-gray-med text-small"
      style={{
        borderColor: "var(--color-border-strong)",
        background: "#FBFBFA",
        padding: "80px 24px",
        marginTop: "24px",
      }}
    >
      {message}
    </div>
  );
}
