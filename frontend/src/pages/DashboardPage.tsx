import {
  FileText,
  History,
  Inbox,
  Package,
  Plus,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { PageHeader } from "../components/PageHeader";
import { SecondaryButton } from "../components/buttons";
import { StatCard, QuickLinkTile } from "../components/DashboardCards";
import {
  useDashboardSummaryQuery,
  useInvalidateDashboard,
} from "../lib/queries/dashboard";
import { hasRole, useAuth } from "../lib/auth";
import { ROLE_ADMIN, ROLE_REQUESTER, ROLE_SOLUTION_OWNER } from "../lib/types";

export function DashboardPage() {
  const { user } = useAuth();
  const invalidate = useInvalidateDashboard();

  useEffect(() => {
    document.title = "Dashboard — Estimator";
  }, []);

  const summaryQuery = useDashboardSummaryQuery();
  const isRefreshing = summaryQuery.isFetching;

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
  needsRevision: "/requests?status=NEEDS_REVISION",
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

// ---- quick links section ----------------------------------------------------

interface QuickLink {
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  requiresRole: string;
}

const QUICK_LINKS: QuickLink[] = [
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
