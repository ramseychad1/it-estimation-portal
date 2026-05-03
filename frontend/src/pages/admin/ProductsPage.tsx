import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  History,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { ListToolbar } from "../../components/ListToolbar";
import { SearchInput } from "../../components/SearchInput";
import { FilterDropdown } from "../../components/FilterDropdown";
import { KebabMenu, type KebabMenuItem } from "../../components/KebabMenu";
import { StatusBadge } from "../../components/StatusBadge";
import { ColumnsToggle, useColumnsVisibility } from "../../components/ColumnsToggle";
import { DataTable, type DataTableColumn } from "../../components/data-table/DataTable";
import { PrimaryButton, SecondaryButton } from "../../components/buttons";
import { UserCell } from "../../components/UserCell";
import { EmptyState } from "../../components/EmptyState";
import { useToast } from "../../components/Toast";
import { relativeTime } from "../../lib/relativeTime";
import {
  getProduct,
  productsExportUrl,
  type ProductDetail,
  type ProductListItem,
  type ProductMode,
} from "../../lib/api/products";
import {
  useActivateProductMutation,
  useDeactivateProductMutation,
  useProductsQuery,
} from "../../lib/queries/products";
import { useTeamsQuery } from "../../lib/queries/teams";
import { NewProductDrawer } from "./products/NewProductDrawer";
import { EditProductDrawer } from "./products/EditProductDrawer";
import { DeleteProductModal } from "./products/DeleteProductModal";

type DrawerState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; product: ProductDetail };

const PAGE_SIZE = 25;

const PRODUCTS_COLUMN_DEFS = [
  { key: "name", label: "Name" },
  { key: "mode", label: "Mode" },
  { key: "team", label: "Team" },
  { key: "subFeatureCount", label: "Sub-features" },
  { key: "questionCount", label: "Questions" },
  { key: "status", label: "Status" },
  { key: "updatedAt", label: "Last updated" },
  { key: "updatedBy", label: "Updated by" },
];
const PRODUCTS_REQUIRED_COLS = ["name"];

export function ProductsPage() {
  useEffect(() => {
    document.title = "Products — Estimator";
  }, []);

  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"" | ProductMode>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [teamIdFilter, setTeamIdFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ by: string; dir: "asc" | "desc" }>({
    by: "name",
    dir: "asc",
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<ProductDetail | null>(null);
  const [hiddenCols, setHiddenCols] = useColumnsVisibility("products", PRODUCTS_REQUIRED_COLS);

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      mode: modeFilter || undefined,
      status: statusFilter,
      teamId: teamIdFilter,
      page,
      size: PAGE_SIZE,
      sort: `${sort.by},${sort.dir}`,
    }),
    [search, modeFilter, statusFilter, teamIdFilter, page, sort],
  );

  const productsQuery = useProductsQuery(queryParams);
  const activateMutation = useActivateProductMutation();
  const deactivateMutation = useDeactivateProductMutation();
  const teamsQuery = useTeamsQuery({ status: "ACTIVE", size: 100 });

  const items = productsQuery.data?.items ?? [];
  const totalElements = productsQuery.data?.totalElements ?? 0;
  const totalPages = productsQuery.data?.totalPages ?? 1;
  const hasFilter = !!search.trim() || modeFilter !== "" || statusFilter !== "ALL" || teamIdFilter !== undefined;

  function clearSelection() {
    setSelectedIds([]);
  }

  function resetFilters() {
    setSearch("");
    setModeFilter("");
    setStatusFilter("ALL");
    setTeamIdFilter(undefined);
    setPage(0);
  }

  async function openEdit(row: ProductListItem) {
    try {
      const full = await getProduct(row.id);
      setDrawer({ mode: "edit", product: full });
    } catch {
      toast.error("Could not load that product.");
    }
  }

  async function requestDelete(row: ProductListItem) {
    try {
      const full = await getProduct(row.id);
      setDeleteTarget(full);
    } catch {
      toast.error("Could not load that product.");
    }
  }

  function buildKebab(row: ProductListItem): KebabMenuItem[] {
    return [
      {
        label: "Open",
        onSelect: () => navigate(`/catalog/products/${row.id}`),
      },
      {
        label: "Edit Product",
        icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () => void openEdit(row),
      },
      {
        label: "View history",
        icon: <History className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () => navigate(`/catalog/products/${row.id}#history`),
      },
      { kind: "divider" },
      row.active
        ? {
            label: "Deactivate",
            icon: <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />,
            onSelect: () =>
              deactivateMutation.mutate(row.id, {
                onSuccess: () => toast.success(`${row.name} deactivated.`),
                onError: () => toast.error("Could not deactivate that product."),
              }),
          }
        : {
            label: "Activate",
            icon: <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
            onSelect: () =>
              activateMutation.mutate(row.id, {
                onSuccess: () => toast.success(`${row.name} activated.`),
                onError: (err) =>
                  toast.error(
                    err instanceof Error && err.message.includes("Cannot reactivate")
                      ? err.message
                      : "Could not activate that product.",
                  ),
              }),
          },
      {
        label: "Delete",
        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        destructive: true,
        onSelect: () => void requestDelete(row),
      },
    ];
  }

  const allColumns: DataTableColumn<ProductListItem>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      accessor: (r) => r.name,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-near-black" style={{ fontSize: 14 }}>
            {r.name}
          </span>
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {r.mode === "CONTAINER"
              ? `${r.subFeatureCount} sub-feature${r.subFeatureCount === 1 ? "" : "s"}`
              : "Direct template"}
          </span>
        </div>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      width: 110,
      render: (r) => <ModePill mode={r.mode} />,
    },
    {
      key: "team",
      header: "Team",
      width: 150,
      render: (r) => r.team ? (
        <span className="text-near-black" style={{ fontSize: 13 }}>{r.team.name}</span>
      ) : (
        <span className="text-warm-gray-med" style={{ fontSize: 13 }}>—</span>
      ),
    },
    {
      key: "subFeatureCount",
      header: "Sub-features",
      align: "right",
      width: 110,
      render: (r) => (
        <span className="tabular-nums text-near-black" style={{ fontSize: 12 }}>
          {r.mode === "CONTAINER" ? r.subFeatureCount : "—"}
        </span>
      ),
    },
    {
      key: "questionCount",
      header: "Questions",
      align: "right",
      width: 110,
      render: (r) => (
        <span className="tabular-nums text-near-black" style={{ fontSize: 12 }}>
          {r.questionCount}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 100,
      render: (r) => (
        <StatusBadge variant={r.active ? "active" : "inactive"}>
          {r.active ? "Active" : "Inactive"}
        </StatusBadge>
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
      key: "updatedBy",
      header: "Updated by",
      width: 160,
      render: (r) => <UserCell userId={r.updatedBy} />,
    },
    {
      key: "actions",
      header: "",
      width: 48,
      preventRowClick: true,
      render: (r) => <KebabMenu items={buildKebab(r)} />,
    },
  ];
  const columns = allColumns.filter((c) => !hiddenCols.has(c.key) || c.key === "actions");

  // --- bulk strip actions ---
  async function bulkDeactivate() {
    for (const id of selectedIds) {
      await deactivateMutation.mutateAsync(id).catch(() => {});
    }
    toast.success(`${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"} deactivated.`);
    clearSelection();
  }
  async function bulkActivate() {
    for (const id of selectedIds) {
      await activateMutation.mutateAsync(id).catch(() => {});
    }
    toast.success(`${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"} activated.`);
    clearSelection();
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Catalog" }, { label: "Products" }]}
        title="Products"
        subtitle="The catalog of products and sub-features that estimate requests are built from."
        actions={
          <PrimaryButton onClick={() => setDrawer({ mode: "create" })}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            New Product
          </PrimaryButton>
        }
      />

      <div className="mt-6">
        <ListToolbar
          selection={
            selectedIds.length > 0
              ? {
                  count: selectedIds.length,
                  actions: (
                    // Bulk delete is intentionally omitted — deleting a
                    // Product cascades through sub-features + questions,
                    // and that level of destruction benefits from the
                    // per-row typed-name confirmation in the kebab Delete
                    // path. Activate/Deactivate are reasonable bulk ops.
                    <div className="flex items-center gap-2">
                      <SecondaryButton onClick={() => void bulkActivate()}>Activate</SecondaryButton>
                      <SecondaryButton onClick={() => void bulkDeactivate()}>Deactivate</SecondaryButton>
                    </div>
                  ),
                  onClear: clearSelection,
                }
              : undefined
          }
        >
          <SearchInput
            placeholder="Search products and sub-features…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            width={320}
          />
          <FilterDropdown
            mode="single"
            label="Mode"
            value={modeFilter}
            options={[
              { value: "", label: "All" },
              { value: "ATOMIC", label: "Atomic" },
              { value: "CONTAINER", label: "Container" },
            ]}
            onChange={(v) => setModeFilter(v as "" | ProductMode)}
          />
          <FilterDropdown
            mode="single"
            label="Status"
            value={statusFilter}
            options={[
              { value: "ALL", label: "All" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            onChange={(v) => setStatusFilter(v as "ALL" | "ACTIVE" | "INACTIVE")}
          />
          <FilterDropdown
            mode="single"
            label="Team"
            value={teamIdFilter !== undefined ? String(teamIdFilter) : ""}
            options={[
              { value: "", label: "All teams" },
              ...(teamsQuery.data?.items ?? []).map((t) => ({
                value: String(t.id),
                label: t.name,
              })),
            ]}
            onChange={(v) => setTeamIdFilter(v ? Number(v) : undefined)}
          />
          <ListToolbar.Spacer />
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {totalElements} {totalElements === 1 ? "product" : "products"}
          </span>
          <ColumnsToggle
            storageKey="products"
            columns={PRODUCTS_COLUMN_DEFS}
            required={PRODUCTS_REQUIRED_COLS}
            hidden={hiddenCols}
            onChange={setHiddenCols}
          />
          <a
            href={productsExportUrl(queryParams)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-body font-medium text-near-black bg-white hover:bg-warm-gray-light"
            style={{ border: "1px solid var(--color-border-strong)" }}
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            Export
          </a>
        </ListToolbar>

        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={productsQuery.isLoading}
          ariaLabel="Products"
          sort={{
            by: sort.by,
            dir: sort.dir,
            onChange: (by, dir) => setSort({ by, dir }),
          }}
          selection={{ selectedIds, onChange: setSelectedIds }}
          onRowClick={(r) => navigate(`/catalog/products/${r.id}`)}
          emptyState={
            hasFilter ? (
              <EmptyState
                variant="inline"
                title="No products match your filters"
                description="Try widening the search or removing some filters."
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
            ) : (
              <EmptyState
                title="No products yet"
                description="Add your first product to start building estimate templates."
                action={
                  <PrimaryButton onClick={() => setDrawer({ mode: "create" })}>
                    <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                    New Product
                  </PrimaryButton>
                }
              />
            )
          }
        />

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

      <NewProductDrawer
        open={drawer.mode === "create"}
        onClose={() => setDrawer({ mode: "closed" })}
      />
      <EditProductDrawer
        open={drawer.mode === "edit"}
        product={drawer.mode === "edit" ? drawer.product : null}
        onClose={() => setDrawer({ mode: "closed" })}
        onRequestDelete={(p) => {
          setDrawer({ mode: "closed" });
          setDeleteTarget(p);
        }}
        onShowHistory={(p) => navigate(`/catalog/products/${p.id}#history`)}
      />
      <DeleteProductModal
        open={!!deleteTarget}
        product={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

function ModePill({ mode }: { mode: ProductMode }) {
  const isAtomic = mode === "ATOMIC";
  return (
    <span
      data-testid={`mode-pill-${mode.toLowerCase()}`}
      className="inline-flex items-center text-near-black"
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: isAtomic ? "var(--color-warm-gray-light)" : "var(--color-light-blue-soft)",
        border: isAtomic
          ? "1px solid var(--color-border-strong)"
          : "1px solid rgba(187,221,230,0.7)",
      }}
    >
      {isAtomic ? "Atomic" : "Container"}
    </span>
  );
}
