import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import { ColumnsToggle, useColumnsVisibility } from "../components/ColumnsToggle";
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
import { UserCell } from "../components/UserCell";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { useProductsQuery } from "../lib/queries/products";
import { useTeamsQuery } from "../lib/queries/teams";
import {
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const param = searchParams.get("status")?.toUpperCase();
    const valid: StatusFilter[] = ["ALL_OPEN", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED"];
    return (valid.includes(param as StatusFilter) ? param : "ALL_OPEN") as StatusFilter;
  });
  const [productFilter, setProductFilter] = useState<"" | string>("");
  const [teamFilter, setTeamFilter] = useState<"" | string>("");
  const [mineOnly, setMineOnly] = useState(false);
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
      page,
      size: PAGE_SIZE,
    }),
    [statusFilter, debouncedSearch, productFilter, teamFilter, mineOnly, page],
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
    mineOnly;
  const isEmpty = !queueQuery.isLoading && items.length === 0;

  function resetFilters() {
    setSearch("");
    setStatusFilter("ALL_OPEN");
    setProductFilter("");
    setTeamFilter("");
    setMineOnly(false);
    setPage(0);
  }

  function buildKebab(row: EstimateRequestListItem): KebabMenuItem[] {
    // Per-item review (Phase 9b): starting a review happens on the detail
    // page per item. The queue navigates directly — no request-level claim.
    if (row.derivedStatus === "IN_REVIEW") {
      return [
        {
          label: "Continue review",
          onSelect: () => navigate(`/review/${row.id}`),
        },
      ];
    }
    if (row.derivedStatus === "SUBMITTED") {
      return [{ label: "Review", onSelect: () => navigate(`/review/${row.id}`) }];
    }
    return [{ label: "View", onSelect: () => navigate(`/review/${row.id}`) }];
  }

  const allColumns: DataTableColumn<EstimateRequestListItem>[] = [
    {
      key: "title",
      header: "Title",
      sortable: false,
      accessor: (r) => r.title,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-near-black" style={{ fontSize: 14 }}>
            {r.title}
          </span>
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
      // The list DTO doesn't include requesterId. The detail page surfaces
      // the requester name. Carry-over #11: extend list DTO with requesterId
      // so the queue can render UserCell here too.
      render: () => (
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>—</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      render: (r) => {
        const { variant, label } = estimateStatusBadge(r.derivedStatus);
        return <StatusBadge variant={variant}>{label}</StatusBadge>;
      },
    },
    {
      key: "reviewer",
      header: "Reviewer",
      width: 160,
      render: () => (
        // List DTO doesn't include reviewerId / reviewerStatus today.
        // Surface the per-actor "You / Other / Unclaimed" affordance on
        // the detail page; the queue's reviewer column is informational
        // until the list DTO grows.
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>—</span>
      ),
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
    </>
  );
}

// Re-using the relativeTime util from /lib but via a local alias so tests
// can mock it cheaply if needed.
import { relativeTime as relTime } from "../lib/relativeTime";

void UserCell;
