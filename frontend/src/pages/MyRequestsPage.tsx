import { useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/ConfirmModal";
import { ColumnsToggle, useColumnsVisibility } from "../components/ColumnsToggle";
import { DataTable, type DataTableColumn } from "../components/data-table/DataTable";
import { EmptyState } from "../components/EmptyState";
import { FilterDropdown } from "../components/FilterDropdown";
import { KebabMenu, type KebabMenuItem } from "../components/KebabMenu";
import { ListToolbar } from "../components/ListToolbar";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../components/buttons";
import { SearchInput } from "../components/SearchInput";
import { StatusBadge, estimateStatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import {
  useDiscardDraftMutation,
  useMyRequestsQuery,
} from "../lib/queries/estimates";
import {
  type EstimateRequestListItem,
  type EstimateStatus,
} from "../lib/api/estimates";
import { relativeTime } from "../lib/relativeTime";
import { useDebouncedValue } from "../lib/useDebouncedValue";

const PAGE_SIZE = 25;

const COLUMN_DEFS = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "submittedAt", label: "Submitted" },
  { key: "updatedAt", label: "Last updated" },
];
const REQUIRED_COLS = ["title"];

type StatusFilter = "ALL" | EstimateStatus;

export function MyRequestsPage() {
  useEffect(() => {
    document.title = "Estimate requests — Estimator";
  }, []);

  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(0);
  const [hiddenCols, setHiddenCols] = useColumnsVisibility(
    "my-requests-columns",
    REQUIRED_COLS,
  );
  const [discardTarget, setDiscardTarget] =
    useState<EstimateRequestListItem | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const queryParams = useMemo(
    () => ({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      search: debouncedSearch.trim() || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [statusFilter, debouncedSearch, page],
  );
  const requestsQuery = useMyRequestsQuery(queryParams);
  const discardMutation = useDiscardDraftMutation();

  const items = requestsQuery.data?.items ?? [];
  const totalElements = requestsQuery.data?.totalElements ?? 0;
  const totalPages = requestsQuery.data?.totalPages ?? 1;
  const hasFilter = statusFilter !== "ALL" || !!debouncedSearch.trim();
  const isEmpty = !requestsQuery.isLoading && items.length === 0;

  function resetFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setPage(0);
  }

  function buildKebab(row: EstimateRequestListItem): KebabMenuItem[] {
    const open: KebabMenuItem = {
      label: "Open",
      onSelect: () => navigate(`/requests/${row.id}`),
    };
    const discard: KebabMenuItem = {
      label: "Discard",
      destructive: true,
      onSelect: () => setDiscardTarget(row),
    };
    const downloadSummary: KebabMenuItem = {
      // Disabled — document export ships in a later phase. KebabMenu
      // doesn't carry tooltips today; the disabled state alone signals
      // "not available." Upgrade KebabMenuItem with a `tooltip` slot if
      // we add more disabled-with-explanation items.
      label: "Download summary",
      disabled: true,
      onSelect: () => undefined,
    };

    switch (row.status) {
      case "DRAFT":
        return [open, discard];
      case "REJECTED":
        return [open, discard];
      case "APPROVED":
        return [open, downloadSummary];
      case "SUBMITTED":
      case "IN_REVIEW":
      default:
        return [open];
    }
  }

  function confirmDiscard() {
    if (!discardTarget) return;
    const target = discardTarget;
    discardMutation.mutate(target.id, {
      onSuccess: () => {
        toast.success(`Discarded "${target.title}".`);
        setDiscardTarget(null);
      },
      onError: () => toast.error("Could not discard that request."),
    });
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
            {r.subFeatureName
              ? `${r.productName} · ${r.subFeatureName}`
              : r.productName}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      render: (r) => {
        const { variant, label } = estimateStatusBadge(r.status);
        return <StatusBadge variant={variant}>{label}</StatusBadge>;
      },
    },
    {
      key: "submittedAt",
      header: "Submitted",
      width: 130,
      render: (r) => (
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {r.submittedAt ? relativeTime(r.submittedAt) : "—"}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: "Last updated",
      width: 130,
      render: (r) => (
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {r.updatedAt ? relativeTime(r.updatedAt) : "—"}
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
        breadcrumb={[{ label: "Workspace" }, { label: "Estimate requests" }]}
        title="Estimate requests"
        subtitle="Your estimate requests, drafts and submitted."
        actions={
          <PrimaryButton onClick={() => navigate("/requests/new")}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            New estimate request
          </PrimaryButton>
        }
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
              { value: "ALL", label: "All" },
              { value: "DRAFT", label: "Draft" },
              { value: "SUBMITTED", label: "Submitted" },
              { value: "IN_REVIEW", label: "In review" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          <ListToolbar.Spacer />
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {totalElements} {totalElements === 1 ? "request" : "requests"}
          </span>
          <ColumnsToggle
            storageKey="my-requests-columns"
            columns={COLUMN_DEFS}
            required={REQUIRED_COLS}
            hidden={hiddenCols}
            onChange={setHiddenCols}
          />
        </ListToolbar>

        {isEmpty && !hasFilter ? (
          <EmptyState
            icon={FileText}
            title="No estimate requests yet"
            description="Create your first request to get an estimate from the Solution Owner team."
            action={
              <PrimaryButton onClick={() => navigate("/requests/new")}>
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                New estimate request
              </PrimaryButton>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            loading={requestsQuery.isLoading}
            ariaLabel="My estimate requests"
            onRowClick={(r) => navigate(`/requests/${r.id}`)}
            emptyState={
              hasFilter ? (
                <EmptyState
                  variant="inline"
                  title="No requests match your filters"
                  description="Try widening the search or clearing the status filter."
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
        open={!!discardTarget}
        title="Discard this draft?"
        body={
          discardTarget ? (
            <p className="text-body text-warm-gray-med m-0">
              "{discardTarget.title}" will be permanently deleted. This can't be
              undone.
            </p>
          ) : null
        }
        confirmLabel="Discard"
        cancelLabel="Keep draft"
        destructive
        onCancel={() => setDiscardTarget(null)}
        onConfirm={confirmDiscard}
      />
    </>
  );
}
