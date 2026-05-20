import { useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Toggle } from "../components/Toggle";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { isAdmin } from "../lib/permissions";
import {
  useAdminDeleteRequestMutation,
  useDiscardDraftMutation,
  useMyRequestsQuery,
} from "../lib/queries/estimates";
import {
  type EstimateRequestListItem,
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

type StatusFilter = "ALL" | "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "PARTIALLY_APPROVED" | "NEEDS_REVISION";

export function MyRequestsPage() {
  useEffect(() => {
    document.title = "Estimate requests — Estimator";
  }, []);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const userIsAdmin = isAdmin(user?.roles ?? []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const param = searchParams.get("status")?.toUpperCase();
    const valid: StatusFilter[] = ["ALL", "DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED", "PARTIALLY_APPROVED", "NEEDS_REVISION"];
    return (valid.includes(param as StatusFilter) ? param : "ALL") as StatusFilter;
  });
  const [allRequests, setAllRequests] = useState(false);
  const [page, setPage] = useState(0);
  const [hiddenCols, setHiddenCols] = useColumnsVisibility(
    "my-requests-columns",
    REQUIRED_COLS,
  );
  const [discardTarget, setDiscardTarget] =
    useState<EstimateRequestListItem | null>(null);
  const [adminDeleteTarget, setAdminDeleteTarget] =
    useState<EstimateRequestListItem | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const queryParams = useMemo(
    () => ({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      search: debouncedSearch.trim() || undefined,
      page,
      size: PAGE_SIZE,
      allRequests: allRequests || undefined,
    }),
    [statusFilter, debouncedSearch, page, allRequests],
  );
  const requestsQuery = useMyRequestsQuery(queryParams);
  const discardMutation = useDiscardDraftMutation();
  const adminDeleteMutation = useAdminDeleteRequestMutation();

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
    const adminDelete: KebabMenuItem = {
      label: "Delete",
      destructive: true,
      onSelect: () => setAdminDeleteTarget(row),
    };
    const downloadSummary: KebabMenuItem = {
      label: "Download summary",
      disabled: true,
      onSelect: () => undefined,
    };

    if (userIsAdmin) {
      if (row.derivedStatus === "APPROVED") return [open, downloadSummary, adminDelete];
      return [open, adminDelete];
    }

    // Non-admin: in all-requesters mode the admin toggle is off for non-admins,
    // but guard defensively — only "Open" is safe when viewing someone else's row.
    if (allRequests) return [open];

    switch (row.derivedStatus) {
      case "DRAFT":
      case "REJECTED":
      case "NEEDS_REVISION":
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

  function confirmAdminDelete() {
    if (!adminDeleteTarget) return;
    const target = adminDeleteTarget;
    adminDeleteMutation.mutate(target.id, {
      onSuccess: () => {
        toast.success(`Deleted "${target.title}".`);
        setAdminDeleteTarget(null);
      },
      onError: () => toast.error("Could not delete that request."),
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
            {r.productNames}
            {r.itemCount > 1 && (
              <span style={{ marginLeft: 4 }}>· {r.itemCount} products</span>
            )}
          </span>
        </div>
      ),
    },
    ...(allRequests ? [{
      key: "requester",
      header: "Requester",
      width: 160,
      render: (r: EstimateRequestListItem) => (
        <span className="text-near-black" style={{ fontSize: 13 }}>
          {r.requesterName ?? "—"}
        </span>
      ),
    } as DataTableColumn<EstimateRequestListItem>] : []),
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
        subtitle={
          allRequests
            ? "All estimate requests across all users."
            : "Your estimate requests, drafts and submitted."
        }
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
              { value: "PARTIALLY_APPROVED", label: "Partially approved" },
              { value: "NEEDS_REVISION", label: "Needs revision" },
            ]}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          {userIsAdmin && (
            <Toggle
              checked={allRequests}
              onCheckedChange={(v) => { setAllRequests(v); setPage(0); }}
              label="All requesters"
            />
          )}
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
            ariaLabel={allRequests ? "All estimate requests" : "My estimate requests"}
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

      <ConfirmModal
        open={!!adminDeleteTarget}
        title="Delete this request?"
        body={
          adminDeleteTarget ? (
            <p className="text-body text-warm-gray-med m-0">
              "{adminDeleteTarget.title}" and all of its items, answers, and attachments will be permanently removed. This action is logged and cannot be undone.
            </p>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setAdminDeleteTarget(null)}
        onConfirm={confirmAdminDelete}
      />
    </>
  );
}
