import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import { ColumnsToggle, useColumnsVisibility } from "../components/ColumnsToggle";
import { ConfirmModal } from "../components/ConfirmModal";
import { DataTable, type DataTableColumn } from "../components/data-table/DataTable";
import { EmptyState } from "../components/EmptyState";
import { FilterDropdown } from "../components/FilterDropdown";
import { KebabMenu, type KebabMenuItem } from "../components/KebabMenu";
import { ListToolbar } from "../components/ListToolbar";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { SecondaryButton } from "../components/buttons";
import { StatusBadge, estimateStatusBadge } from "../components/StatusBadge";
import { Toggle } from "../components/Toggle";
import { useAuth } from "../lib/auth";
import { isAdmin } from "../lib/permissions";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { useProductsQuery } from "../lib/queries/products";
import { useTeamsQuery } from "../lib/queries/teams";
import {
  useAdminDeleteRequestMutation,
  useReviewQueueQuery,
} from "../lib/queries/reviews";
import type {
  EstimateRequestListItem,
} from "../lib/api/estimates";

const PAGE_SIZE = 25;

const COLUMN_DEFS = [
  { key: "title", label: "Title" },
  { key: "items", label: "Items" },
  { key: "requester", label: "Requester" },
  { key: "status", label: "Status" },
  { key: "reviewer", label: "Reviewer" },
  { key: "questions", label: "Questions" },
  { key: "submittedAt", label: "Submitted" },
];
const REQUIRED_COLS = ["title"];

type StatusFilter = "ALL_OPEN" | string;

export function ReviewQueuePage() {
  useEffect(() => {
    document.title = "Review queue — Estimator";
  }, []);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const adminDelete = useAdminDeleteRequestMutation();
  const [deleteTarget, setDeleteTarget] = useState<EstimateRequestListItem | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const param = searchParams.get("status")?.toUpperCase();
    const valid: StatusFilter[] = ["ALL_OPEN", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED"];
    return (valid.includes(param as StatusFilter) ? param : "ALL_OPEN") as StatusFilter;
  });
  const [productFilter, setProductFilter] = useState<"" | string>("");
  const [teamFilter, setTeamFilter] = useState<"" | string>("");
  const [mineOnly, setMineOnly] = useState(false);
  const [intakeOnly, setIntakeOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [hiddenCols, setHiddenCols] = useColumnsVisibility(
    "review-queue-columns",
    REQUIRED_COLS,
  );

  const debouncedSearch = useDebouncedValue(search, 300);

  const queryParams = useMemo(
    () => ({
      // Backend defaults to "all open" (Submitted + In Review) when status
      // is omitted. Send the specific status only when the user picked one.
      status: statusFilter === "ALL_OPEN" ? undefined : statusFilter,
      search: debouncedSearch.trim() || undefined,
      productId: productFilter ? Number(productFilter) : undefined,
      teamId: teamFilter ? Number(teamFilter) : undefined,
      mineOnly: mineOnly || undefined,
      requestType: intakeOnly ? "INTAKE" : undefined,
      page,
      size: PAGE_SIZE,
    }),
    [statusFilter, debouncedSearch, productFilter, teamFilter, mineOnly, intakeOnly, page],
  );

  const queueQuery = useReviewQueueQuery(queryParams);

  // Product filter list — pulled from the catalog so it always matches
  // the active product set without an extra endpoint.
  const productsQuery = useProductsQuery({ status: "ACTIVE", size: 200 });
  const teamsQuery = useTeamsQuery({ status: "ACTIVE", size: 100 });
  const productOptions = useMemo(() => {
    const opts = (productsQuery.data?.items ?? []).map((p) => ({
      value: String(p.id),
      label: p.name,
    }));
    return [{ value: "", label: "All products" }, ...opts];
  }, [productsQuery.data?.items]);

  const items = queueQuery.data?.items ?? [];
  const totalElements = queueQuery.data?.totalElements ?? 0;
  const totalPages = queueQuery.data?.totalPages ?? 1;
  const hasFilter =
    !!debouncedSearch.trim() ||
    statusFilter !== "ALL_OPEN" ||
    productFilter !== "" ||
    teamFilter !== "" ||
    mineOnly ||
    intakeOnly;
  const isEmpty = !queueQuery.isLoading && items.length === 0;

  function resetFilters() {
    setSearch("");
    setStatusFilter("ALL_OPEN");
    setProductFilter("");
    setTeamFilter("");
    setMineOnly(false);
    setIntakeOnly(false);
    setPage(0);
  }

  function buildKebab(row: EstimateRequestListItem): KebabMenuItem[] {
    const items: KebabMenuItem[] = [];

    if (row.derivedStatus === "IN_REVIEW") {
      items.push({ label: "Continue review", onSelect: () => navigate(`/review/${row.id}`) });
    } else if (row.derivedStatus === "SUBMITTED") {
      items.push({ label: "Review", onSelect: () => navigate(`/review/${row.id}`) });
    } else {
      items.push({ label: "View", onSelect: () => navigate(`/review/${row.id}`) });
    }

    if (currentUser && isAdmin(currentUser.roles)) {
      items.push({ label: "Delete request", destructive: true, onSelect: () => setDeleteTarget(row) });
    }

    return items;
  }

  const allColumns: DataTableColumn<EstimateRequestListItem>[] = [
    {
      key: "title",
      header: "Title",
      sortable: false,
      accessor: (r) => r.title,
      render: (r) => (
        <div className="flex flex-col" style={{ gap: 2 }}>
          <div className="flex items-center" style={{ gap: 6 }}>
            <span className="font-semibold text-near-black" style={{ fontSize: 14 }}>
              {r.title}
            </span>
            {r.requestType === "INTAKE" && (
              <span
                className="inline-flex items-center font-medium"
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(187, 221, 230, 0.35)",
                  border: "1px solid rgba(44, 86, 102, 0.30)",
                  color: "#2C5666",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                }}
              >
                Intake
              </span>
            )}
          </div>
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {r.productNames}
          </span>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      width: 70,
      render: (r) => (
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {r.itemCount ?? "—"}
        </span>
      ),
    },
    {
      key: "requester",
      header: "Requester",
      width: 180,
      render: (r) => (
        <span style={{ fontSize: 12 }}>
          {r.requesterName ?? <span className="text-warm-gray-med">—</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 140,
      render: (r) => {
        const { variant, label } = estimateStatusBadge(r.derivedStatus);
        return (
          <div className="flex flex-col" style={{ gap: 3 }}>
            <StatusBadge variant={variant}>{label}</StatusBadge>
            {r.derivedStatus === "PARTIALLY_APPROVED" && r.itemCount > 1 && (
              <span className="text-warm-gray-med" style={{ fontSize: 11 }}>
                {r.approvedItemCount} of {r.itemCount} approved
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "reviewer",
      header: "Reviewer",
      width: 160,
      render: (r) => (
        <span
          style={{ fontSize: 12 }}
          className={r.reviewerSummary === "Unclaimed" ? "text-warm-gray-med" : undefined}
        >
          {r.reviewerSummary ?? "—"}
        </span>
      ),
    },
    {
      key: "questions",
      header: "Questions",
      width: 100,
      render: (r) => {
        if (r.totalQuestionsCount === 0) {
          return <span className="text-warm-gray-med" style={{ fontSize: 12 }}>—</span>;
        }
        const allAnswered = r.answeredQuestionsCount >= r.totalQuestionsCount;
        return (
          <span
            style={{ fontSize: 12 }}
            className={allAnswered ? undefined : "text-warm-gray-med"}
            title={`${r.answeredQuestionsCount} of ${r.totalQuestionsCount} questions answered`}
          >
            {r.answeredQuestionsCount}
            <span className="text-warm-gray-med">
              {" / "}{r.totalQuestionsCount}
            </span>
          </span>
        );
      },
    },
    {
      key: "submittedAt",
      header: "Submitted",
      width: 130,
      render: (r) => (
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {r.submittedAt ? relTime(r.submittedAt) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 48,
      preventRowClick: true,
      render: (r) => <KebabMenu items={buildKebab(r)} />,
    },
  ];
  const columns = allColumns.filter(
    (c) => !hiddenCols.has(c.key) || c.key === "actions",
  );

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Workspace" }, { label: "Review queue" }]}
        title="Review queue"
        subtitle="Estimate requests containing items from products assigned to your team."
      />

      <div className="mt-6">
        <ListToolbar>
          <SearchInput
            placeholder="Search requests by title…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            width={320}
          />
          <FilterDropdown
            mode="single"
            label="Status"
            value={statusFilter}
            options={[
              { value: "ALL_OPEN", label: "All open" },
              { value: "SUBMITTED", label: "Submitted" },
              { value: "IN_REVIEW", label: "In review" },
            ]}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          <FilterDropdown
            mode="single"
            label="Product"
            value={productFilter}
            options={productOptions}
            onChange={(v) => setProductFilter(v)}
          />
          <FilterDropdown
            mode="single"
            label="Team"
            value={teamFilter}
            options={[
              { value: "", label: "All teams" },
              ...(teamsQuery.data?.items ?? []).map((t) => ({
                value: String(t.id),
                label: t.name,
              })),
            ]}
            onChange={(v) => setTeamFilter(v)}
          />
          <Toggle
            checked={mineOnly}
            onCheckedChange={setMineOnly}
            label="Mine only"
          />
          <Toggle
            checked={intakeOnly}
            onCheckedChange={setIntakeOnly}
            label="Intake only"
          />
          <ListToolbar.Spacer />
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {totalElements} {totalElements === 1 ? "request" : "requests"}
          </span>
          <ColumnsToggle
            storageKey="review-queue-columns"
            columns={COLUMN_DEFS}
            required={REQUIRED_COLS}
            hidden={hiddenCols}
            onChange={setHiddenCols}
          />
        </ListToolbar>

        {isEmpty && !hasFilter ? (
          <EmptyState
            icon={Inbox}
            title="No requests need your review"
            description="Requests appear here when they contain items from products assigned to your team."
          />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            loading={queueQuery.isLoading}
            ariaLabel="Review queue"
            onRowClick={(r) => navigate(`/review/${r.id}`)}
            emptyState={
              hasFilter ? (
                <EmptyState
                  variant="inline"
                  title="No requests match your filters"
                  description="Try widening the search or clearing a filter."
                  action={
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-near-black bg-transparent border-0 cursor-pointer hover:underline"
                      style={{ fontSize: 13 }}
                    >
                      Reset filters
                    </button>
                  }
                />
              ) : null
            }
          />
        )}

        {totalPages > 1 && (
          <div
            className="flex items-center justify-between mt-3"
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--color-warm-gray-light)",
              background: "#FBFBFA",
              fontSize: 12,
            }}
          >
            <span className="text-warm-gray-med">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <SecondaryButton
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </SecondaryButton>
              <SecondaryButton
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </SecondaryButton>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete estimate request?"
        body={
          <>
            <strong>{deleteTarget?.title}</strong> and all of its items will be permanently
            deleted. This action cannot be undone. The deletion will be recorded in the
            Change Log.
          </>
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await adminDelete.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

// Re-using the relativeTime util from /lib but via a local alias so tests
// can mock it cheaply if needed.
import { relativeTime as relTime } from "../lib/relativeTime";

