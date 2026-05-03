import {
  Activity,
  FileText,
  History,
  Inbox,
  Package,
  Plus,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { SecondaryButton } from "../components/buttons";
import { Timeline, TimelineItem } from "../components/Timeline";
import { StatCard, QuickLinkTile } from "../components/DashboardCards";
import {
  useDashboardActivityQuery,
  useDashboardSummaryQuery,
  useInvalidateDashboard,
} from "../lib/queries/dashboard";
import { hasRole, useAuth } from "../lib/auth";
import { ROLE_ADMIN, ROLE_REQUESTER, ROLE_SOLUTION_OWNER } from "../lib/types";
import type { ActivityFeedItem } from "../lib/api/dashboard";
import { relativeTime } from "../lib/relativeTime";

const PAGE_SIZE = 20;

/**
 * The /dashboard landing page. Three sections (stats / activity / quick
 * links) all driven from existing persistence — no new tables.
 *
 * Refresh contract:
 *   - The "Refresh" button invalidates the {@code ['dashboard']} cache
 *     prefix, which sweeps both summary + every activity-page key.
 *   - The "All / Just mine" toggle changes the activity query key, so
 *     flipping it triggers a fresh fetch automatically — no extra wiring.
 *   - React Query's window-focus refetch handles "user came back to the
 *     tab" out of the box (configured per-query via refetchOnWindowFocus).
 */
export function DashboardPage() {
  const { user } = useAuth();
  const invalidate = useInvalidateDashboard();

  const [mineOnly, setMineOnly] = useState(false);
  const [activityPage, setActivityPage] = useState(0);

  // Reset paging back to page 0 when the toggle flips — the previous
  // page index doesn't make sense against a different filter.
  useEffect(() => {
    setActivityPage(0);
  }, [mineOnly]);

  useEffect(() => {
    document.title = "Dashboard — Estimator";
  }, []);

  const summaryQuery = useDashboardSummaryQuery();
  const activityQuery = useDashboardActivityQuery({
    mineOnly,
    page: activityPage,
    size: PAGE_SIZE,
  });

  const isRefreshing = summaryQuery.isFetching || activityQuery.isFetching;

  // Greeting: time-of-day based, falls back to a stable "Welcome back"
  // when first name isn't available (shouldn't happen for authenticated
  // users, but guard anyway).
  const greeting = useMemo(() => {
    const first = user?.firstName?.trim();
    if (!first) return "Welcome back.";
    const h = new Date().getHours();
    const tod = h < 5 ? "evening" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
    return `Good ${tod}, ${first}.`;
  }, [user?.firstName]);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Workspace" }, { label: "Dashboard" }]}
        title="Dashboard"
        subtitle={greeting}
        actions={
          <SecondaryButton
            data-testid="dashboard-refresh"
            onClick={invalidate}
            disabled={isRefreshing}
            aria-label="Refresh dashboard"
          >
            <RefreshCw
              className={isRefreshing ? "animate-spin" : ""}
              style={{ width: 14, height: 14 }}
              strokeWidth={1.5}
            />
            Refresh
          </SecondaryButton>
        }
      />

      <section className="mt-6" data-testid="dashboard-stats">
        <StatCardsGrid
          cards={summaryQuery.data?.cards ?? []}
          isLoading={summaryQuery.isLoading}
        />
      </section>

      <section className="mt-8" data-testid="dashboard-activity">
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <h2 className="m-0 text-near-black font-semibold" style={{ fontSize: 18 }}>
            Recent activity
          </h2>
          <ActivityScopeToggle value={mineOnly} onChange={setMineOnly} />
        </div>
        <ActivitySection
          items={activityQuery.data?.items ?? []}
          totalElements={activityQuery.data?.totalElements ?? 0}
          isLoading={activityQuery.isLoading}
          page={activityPage}
          pageSize={PAGE_SIZE}
          onLoadMore={() => setActivityPage((p) => p + 1)}
        />
      </section>

      <section className="mt-8" data-testid="dashboard-quicklinks">
        <h2
          className="m-0 text-near-black font-semibold"
          style={{ fontSize: 18, marginBottom: 12 }}
        >
          Quick links
        </h2>
        <QuickLinksGrid />
      </section>
    </>
  );
}

// ---- stat cards section -----------------------------------------------------

const CARD_HREFS: Record<string, string> = {
  myDrafts: "/requests?status=DRAFT",
  awaitingReview: "/review?status=SUBMITTED",
  myActiveReviews: "/review?status=IN_REVIEW",
  pendingInvitations: "/admin/users",
  totalActiveUsers: "/admin/users",
};

function StatCardsGrid({
  cards,
  isLoading,
}: {
  cards: { key: string; label: string; count: number; description?: string | null }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
    );
  }
  if (cards.length === 0) {
    // Defensive: every authenticated user gets at least myDrafts +
    // myRecentActivity, so this should never render. Cheap insurance.
    return (
      <p className="text-warm-gray-med text-center" style={{ fontSize: 14 }}>
        No metrics to show right now.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <StatCard
          key={c.key}
          label={c.label}
          count={c.count}
          description={c.description}
          href={CARD_HREFS[c.key]}
        />
      ))}
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div
      aria-hidden="true"
      className="bg-white"
      style={{
        border: "1px solid var(--color-warm-gray-light)",
        borderRadius: 8,
        padding: 24,
        height: 120,
      }}
    >
      <div
        style={{
          height: 32,
          width: 60,
          background: "var(--color-warm-gray-light)",
          borderRadius: 4,
        }}
      />
      <div
        style={{
          height: 14,
          width: 100,
          background: "var(--color-warm-gray-light)",
          borderRadius: 4,
          marginTop: 12,
        }}
      />
    </div>
  );
}

// ---- activity section -------------------------------------------------------

function ActivityScopeToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className="inline-flex"
      role="group"
      aria-label="Activity scope"
      data-testid="activity-scope"
      style={{
        background: "var(--color-warm-gray-light)",
        borderRadius: 6,
        padding: 2,
      }}
    >
      <ScopePill selected={!value} label="All activity" onClick={() => onChange(false)} />
      <ScopePill selected={value} label="Just mine" onClick={() => onChange(true)} />
    </div>
  );
}

function ScopePill({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? "text-near-black font-medium"
          : "text-warm-gray-med hover:text-near-black"
      }
      style={{
        background: selected ? "var(--color-light-blue-soft)" : "transparent",
        border: 0,
        borderRadius: 4,
        padding: "4px 12px",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function ActivitySection({
  items,
  totalElements,
  isLoading,
  page,
  pageSize,
  onLoadMore,
}: {
  items: ActivityFeedItem[];
  totalElements: number;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onLoadMore: () => void;
}) {
  if (isLoading && items.length === 0) {
    return <p className="text-warm-gray-med" style={{ fontSize: 13 }}>Loading…</p>;
  }
  if (items.length === 0) {
    return <ActivityEmptyState />;
  }
  // Even though the backend returns one page at a time, "Load more" is
  // page-based — the user clicks once to get the next page. We don't
  // accumulate locally because React Query owns the cache; instead, the
  // "Load more" button increments the page key and the component renders
  // both. Simpler approach: render the current page only and offer a
  // button to advance. For the first cut we render only the current page;
  // the grouped-date headers + "see all on Change Log" guidance do most
  // of the wayfinding work.
  const buckets = bucketByDate(items);
  const hasMore = (page + 1) * pageSize < totalElements;

  return (
    <div>
      {buckets.map((b) => (
        <DateBucket key={b.label} label={b.label}>
          <Timeline>
            {b.groups.map((it) => (
              <ActivityRow key={it.id} item={it} />
            ))}
          </Timeline>
        </DateBucket>
      ))}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <SecondaryButton onClick={onLoadMore}>Load more</SecondaryButton>
        </div>
      )}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityFeedItem }) {
  const navigate = useNavigate();
  function onEntityClick() {
    if (item.entityHref) navigate(item.entityHref);
  }
  return (
    <TimelineItem avatar={<Avatar name={item.actor.name} />}>
      <div className="flex items-center gap-3 py-2 px-2 rounded-md">
        <span
          className="text-warm-gray-med tabular-nums"
          style={{ fontSize: 12, width: 80, flexShrink: 0 }}
          title={new Date(item.timestamp).toLocaleString()}
        >
          {relativeTime(item.timestamp)}
        </span>
        <p className="m-0 flex-1 text-near-black" style={{ fontSize: 14 }}>
          {item.entityHref ? (
            <button
              type="button"
              onClick={onEntityClick}
              className="text-near-black bg-transparent border-0 p-0 cursor-pointer hover:underline text-left"
              style={{ fontSize: 14 }}
            >
              {item.description}
            </button>
          ) : (
            <span>{item.description}</span>
          )}
        </p>
        <span
          className="inline-flex items-center px-2 rounded font-medium text-warm-gray-med"
          style={{
            fontSize: 11,
            height: 20,
            background: "var(--color-warm-gray-light)",
          }}
          title={item.entityType}
        >
          {item.entityType}
        </span>
        <span
          className="font-semibold uppercase text-warm-gray-med"
          style={{ fontSize: 11, letterSpacing: "0.04em" }}
        >
          {item.actionLabel}
        </span>
      </div>
    </TimelineItem>
  );
}

function ActivityEmptyState() {
  return (
    <div
      className="text-center rounded-lg"
      data-testid="activity-empty-state"
      style={{
        padding: "60px 24px",
        background: "#FBFBFA",
        border: "1px dashed var(--color-border-strong)",
      }}
    >
      <Activity
        className="mx-auto mb-3 text-warm-gray-med"
        style={{ width: 32, height: 32 }}
        strokeWidth={1.5}
      />
      <p className="m-0 text-near-black font-semibold" style={{ fontSize: 14 }}>
        No activity yet
      </p>
      <p
        className="m-0 mt-1 text-warm-gray-med"
        style={{ fontSize: 13, maxWidth: 480, marginInline: "auto" }}
      >
        As you and your team work in the system, recent changes will appear
        here.
      </p>
    </div>
  );
}

function DateBucket({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p
        className="m-0 mb-2 uppercase text-warm-gray-med font-medium"
        style={{ fontSize: 11, letterSpacing: "0.06em" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  // Same shape the Change Log avatar uses; copied here rather than
  // sharing a primitive because the change-log version is private to
  // ChangeLogEntry. If a third caller appears, lift it to a shared file.
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? "?"
      : parts.length === 1
        ? parts[0][0].toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "var(--color-near-black)",
        color: "#fff",
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {initials}
    </span>
  );
}

interface DateBucketModel {
  label: string;
  groups: ActivityFeedItem[];
}

function bucketByDate(items: ActivityFeedItem[]): DateBucketModel[] {
  const out = new Map<string, ActivityFeedItem[]>();
  for (const it of items) {
    const label = labelForDate(new Date(it.timestamp));
    if (!out.has(label)) out.set(label, []);
    out.get(label)!.push(it);
  }
  return Array.from(out.entries()).map(([label, groups]) => ({ label, groups }));
}

function labelForDate(d: Date): string {
  const today = startOfLocalDay(new Date());
  const ymd = startOfLocalDay(d);
  const diffDays = Math.round((today.getTime() - ymd.getTime()) / (24 * 3600 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  if (today.getFullYear() === d.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

// ---- quick links section ----------------------------------------------------

interface QuickLink {
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  requiresRole: string;
}

const QUICK_LINKS: QuickLink[] = [
  // Requester surfaces
  {
    title: "+ New estimate request",
    description: "Start a new request against a product or sub-feature.",
    to: "/requests/new",
    icon: Plus,
    requiresRole: ROLE_REQUESTER,
  },
  {
    title: "My estimate requests",
    description: "Drafts, submitted, approved, and rejected requests you own.",
    to: "/requests",
    icon: FileText,
    requiresRole: ROLE_REQUESTER,
  },
  // Solution Owner surfaces
  {
    title: "Review queue",
    description: "Submitted requests waiting for an SO to claim or finish.",
    to: "/review",
    icon: Inbox,
    requiresRole: ROLE_SOLUTION_OWNER,
  },
  {
    title: "Browse catalog",
    description: "Products, sub-features, critical questions, and templates.",
    to: "/catalog/products",
    icon: Package,
    requiresRole: ROLE_SOLUTION_OWNER,
  },
  // Admin surfaces
  {
    title: "Manage users",
    description: "Invite users, assign roles, deactivate accounts.",
    to: "/admin/users",
    icon: Shield,
    requiresRole: ROLE_ADMIN,
  },
  {
    title: "Change log",
    description: "Audit history of every mutation in the workspace.",
    to: "/admin/change-log",
    icon: History,
    requiresRole: ROLE_ADMIN,
  },
];

function QuickLinksGrid() {
  const { user } = useAuth();
  const visible = QUICK_LINKS.filter((l) => hasRole(user, l.requiresRole));
  if (visible.length === 0) {
    // Defensive: every authenticated user has at least one role with at
    // least one quick link mapped above.
    return (
      <p className="text-warm-gray-med" style={{ fontSize: 14 }}>
        No quick actions available.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {visible.map((l) => (
        <QuickLinkTile
          key={l.to}
          title={l.title}
          description={l.description}
          to={l.to}
          icon={l.icon}
        />
      ))}
    </div>
  );
}
