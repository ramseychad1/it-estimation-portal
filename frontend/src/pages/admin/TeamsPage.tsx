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
import { PageHeader } from "../../components/PageHeader";
import { ListToolbar } from "../../components/ListToolbar";
import { SearchInput } from "../../components/SearchInput";
import { FilterDropdown } from "../../components/FilterDropdown";
import { KebabMenu, type KebabMenuItem } from "../../components/KebabMenu";
import { StatusBadge } from "../../components/StatusBadge";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ColumnsToggle, useColumnsVisibility } from "../../components/ColumnsToggle";
import { EmptyState } from "../../components/EmptyState";
import { DataTable, type DataTableColumn } from "../../components/data-table/DataTable";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../../components/buttons";
import { UserCell } from "../../components/UserCell";
import { useToast } from "../../components/Toast";
import { relativeTime } from "../../lib/relativeTime";
import {
  getTeam,
  teamsExportUrl,
  type TeamDto,
  type TeamListItem,
  type TeamStatusFilter,
} from "../../lib/api/teams";
import {
  useActivateTeamMutation,
  useBulkActivateTeamsMutation,
  useBulkDeactivateTeamsMutation,
  useBulkDeleteTeamsMutation,
  useDeactivateTeamMutation,
  useDeleteTeamMutation,
  useTeamsQuery,
} from "../../lib/queries/teams";
import { TeamFormDrawer } from "./TeamFormDrawer";
import { TeamHistoryDrawer } from "./TeamHistoryDrawer";
import { ApiError } from "../../lib/api";

type DrawerState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; team: TeamDto }
  | { mode: "history"; team: TeamDto };

const PAGE_SIZE = 25;

const TEAMS_COLUMN_DEFS = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "productCount", label: "# Products" },
  { key: "status", label: "Status" },
  { key: "updatedAt", label: "Last updated" },
  { key: "updatedBy", label: "Updated by" },
];
const TEAMS_REQUIRED_COLS = ["name"];

export function TeamsPage() {
  useEffect(() => {
    document.title = "Teams — Estimator";
  }, []);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TeamStatusFilter>("ALL");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ by: string; dir: "asc" | "desc" }>({
    by: "name",
    dir: "asc",
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<TeamListItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useColumnsVisibility("teams", TEAMS_REQUIRED_COLS);

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      status,
      page,
      size: PAGE_SIZE,
      sort: `${sort.by},${sort.dir}`,
    }),
    [search, status, page, sort],
  );

  const teamsQuery = useTeamsQuery(queryParams);
  const deleteMutation = useDeleteTeamMutation();
  const activateMutation = useActivateTeamMutation();
  const deactivateMutation = useDeactivateTeamMutation();
  const bulkActivate = useBulkActivateTeamsMutation();
  const bulkDeactivate = useBulkDeactivateTeamsMutation();
  const bulkDelete = useBulkDeleteTeamsMutation();
  const toast = useToast();

  const items = teamsQuery.data?.items ?? [];
  const totalElements = teamsQuery.data?.totalElements ?? 0;
  const hasFilter = !!search.trim() || status !== "ALL";

  function clearSelection() {
    setSelectedIds([]);
  }

  async function openEdit(row: TeamListItem) {
    try {
      const full = await getTeam(row.id);
      setDrawer({ mode: "edit", team: full });
    } catch {
      toast.error("Could not load that team.");
    }
  }

  async function openHistory(row: TeamListItem) {
    try {
      const full = await getTeam(row.id);
      setDrawer({ mode: "history", team: full });
    } catch {
      toast.error("Could not load that team.");
    }
  }

  function buildKebab(row: TeamListItem): KebabMenuItem[] {
    return [
      {
        label: "Edit",
        icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () => void openEdit(row),
      },
      {
        label: "View history",
        icon: <History className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () => void openHistory(row),
      },
      { kind: "divider" },
      row.active
        ? {
            label: "Deactivate",
            icon: <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />,
            onSelect: () =>
              deactivateMutation.mutate(row.id, {
                onSuccess: () => toast.success(`${row.name} deactivated.`),
                onError: () => toast.error("Could not deactivate that team."),
              }),
          }
        : {
            label: "Activate",
            icon: <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
            onSelect: () =>
              activateMutation.mutate(row.id, {
                onSuccess: () => toast.success(`${row.name} activated.`),
                onError: () => toast.error("Could not activate that team."),
              }),
          },
      {
        label: "Delete",
        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        destructive: true,
        onSelect: () => setDeleteTarget(row),
      },
    ];
  }

  const allColumns: DataTableColumn<TeamListItem>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      accessor: (r) => r.name,
      render: (r) => <span className="font-semibold text-near-black">{r.name}</span>,
    },
    {
      key: "description",
      header: "Description",
      render: (r) => (
        <span
          className="text-warm-gray-med"
          style={{
            display: "inline-block",
            maxWidth: 280,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "middle",
          }}
        >
          {r.description ?? "—"}
        </span>
      ),
    },
    {
      key: "productCount",
      header: "# Products",
      align: "right",
      width: 110,
      render: (r) => <span className="tabular text-near-black">{r.productCount}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      render: (r) =>
        r.active ? (
          <StatusBadge variant="active">Active</StatusBadge>
        ) : (
          <StatusBadge variant="inactive">Inactive</StatusBadge>
        ),
    },
    {
      key: "updatedAt",
      header: "Last updated",
      sortable: true,
      width: 140,
      render: (r) => (
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {relativeTime(r.updatedAt)}
        </span>
      ),
    },
    {
      key: "updatedBy",
      header: "Updated by",
      width: 180,
      render: (r) => <UserCell userId={r.updatedBy} />,
    },
    {
      key: "actions",
      header: "",
      width: 48,
      align: "right",
      preventRowClick: true,
      render: (r) => <KebabMenu items={buildKebab(r)} ariaLabel={`Actions for ${r.name}`} />,
    },
  ];

  const totalPages = teamsQuery.data?.totalPages ?? 1;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Teams" }]}
        title="Teams"
        subtitle="Manage the teams that contribute hours to estimates."
        actions={
          <PrimaryButton onClick={() => setDrawer({ mode: "create" })}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            New team
          </PrimaryButton>
        }
      />

      <hr
        className="my-6"
        style={{
          height: 1,
          background: "var(--color-warm-gray-light)",
          border: 0,
        }}
      />

      <ListToolbar
        selection={
          selectedIds.length > 0
            ? {
                count: selectedIds.length,
                onClear: clearSelection,
                actions: (
                  <>
                    <SecondaryButton
                      onClick={() =>
                        bulkActivate.mutate(selectedIds, {
                          onSuccess: (res) => {
                            clearSelection();
                            toast.success(`${res.succeeded.length} activated${res.failed.length ? `, ${res.failed.length} failed` : ""}.`);
                          },
                          onError: () => toast.error("Bulk activate failed."),
                        })
                      }
                      disabled={bulkActivate.isPending}
                    >
                      Activate
                    </SecondaryButton>
                    <SecondaryButton
                      onClick={() =>
                        bulkDeactivate.mutate(selectedIds, {
                          onSuccess: (res) => {
                            clearSelection();
                            toast.success(`${res.succeeded.length} deactivated${res.failed.length ? `, ${res.failed.length} failed` : ""}.`);
                          },
                          onError: () => toast.error("Bulk deactivate failed."),
                        })
                      }
                      disabled={bulkDeactivate.isPending}
                    >
                      Deactivate
                    </SecondaryButton>
                    <TertiaryButton
                      onClick={() => setBulkDeleteOpen(true)}
                      className="text-cardinal-red hover:text-cardinal-red"
                      disabled={bulkDelete.isPending}
                    >
                      Delete
                    </TertiaryButton>
                  </>
                ),
              }
            : undefined
        }
      >
        <SearchInput
          placeholder="Search teams…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <FilterDropdown
          mode="single"
          label="Status"
          value={status}
          options={[
            { value: "ALL", label: "All" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
          onChange={(next) => {
            setStatus(next);
            setPage(0);
          }}
        />
        <ListToolbar.Spacer />
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {totalElements === 1 ? "1 team" : `${totalElements} teams`}
        </span>
        <ColumnsToggle
          storageKey="teams"
          columns={TEAMS_COLUMN_DEFS}
          required={TEAMS_REQUIRED_COLS}
          hidden={hiddenCols}
          onChange={setHiddenCols}
        />
        <a
          href={teamsExportUrl({
            search: search.trim() || undefined,
            status: status !== "ALL" ? status : undefined,
          })}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-body font-medium text-near-black bg-white hover:bg-warm-gray-light"
          style={{ border: "1px solid var(--color-border-strong)", textDecoration: "none" }}
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
          Export
        </a>
      </ListToolbar>

      <DataTable<TeamListItem, number>
        columns={allColumns.filter((c) => !hiddenCols.has(c.key))}
        rows={items}
        rowKey={(r) => r.id}
        loading={teamsQuery.isLoading}
        ariaLabel="Teams"
        sort={{
          by: sort.by,
          dir: sort.dir,
          onChange: (by, dir) => setSort({ by, dir }),
        }}
        selection={{ selectedIds, onChange: setSelectedIds }}
        onRowClick={(r) => void openEdit(r)}
        emptyState={
          hasFilter ? (
            <EmptyState
              title="No teams match your filters"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatus("ALL");
                    setPage(0);
                  }}
                  className="text-near-black underline bg-transparent border-0 cursor-pointer"
                  style={{ fontSize: 13 }}
                >
                  Reset filters
                </button>
              }
            />
          ) : (
            <EmptyState
              title="No teams yet"
              description="Add your first team to start building estimates."
              action={
                <PrimaryButton onClick={() => setDrawer({ mode: "create" })}>
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  New team
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
            color: "var(--fg-2)",
            borderRadius: "0 0 6px 6px",
          }}
        >
          <span>
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, totalElements)} of {totalElements}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="bg-white border rounded text-near-black disabled:text-warm-gray-med disabled:cursor-not-allowed"
              style={{
                width: 28, height: 28, fontSize: 12,
                borderColor: "var(--color-border-strong)",
              }}
            >
              ‹
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="bg-white border rounded text-near-black disabled:text-warm-gray-med disabled:cursor-not-allowed"
              style={{
                width: 28, height: 28, fontSize: 12,
                borderColor: "var(--color-border-strong)",
              }}
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* Drawers */}
      <TeamFormDrawer
        open={drawer.mode === "create"}
        team={null}
        onClose={() => setDrawer({ mode: "closed" })}
      />
      <TeamFormDrawer
        open={drawer.mode === "edit"}
        team={drawer.mode === "edit" ? drawer.team : null}
        onClose={() => setDrawer({ mode: "closed" })}
        onShowHistory={(t) => setDrawer({ mode: "history", team: t })}
        onRequestDelete={(t) =>
          setDeleteTarget({
            id: t.id,
            name: t.name,
            description: t.description,
            active: t.active,
            productCount: 0,
            updatedAt: t.updatedAt,
            updatedBy: t.updatedBy,
          })
        }
      />
      <TeamHistoryDrawer
        open={drawer.mode === "history"}
        teamId={drawer.mode === "history" ? drawer.team.id : null}
        teamName={drawer.mode === "history" ? drawer.team.name : undefined}
        onClose={() => setDrawer({ mode: "closed" })}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete '${deleteTarget?.name ?? ""}'?`}
        body={
          <>
            <p className="m-0">
              This permanently removes <strong>{deleteTarget?.name}</strong>.
              Existing estimates that reference this team keep their historical data.
            </p>
            <p className="m-0 mt-2 text-warm-gray-med" style={{ fontSize: 13 }}>
              You can also <em>deactivate</em> a team to hide it from new estimates without losing the record.
            </p>
          </>
        }
        confirmLabel="Delete team"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            toast.success(`${deleteTarget.name} deleted.`);
            setDeleteTarget(null);
            // If the deleted team was open in the edit drawer, close it.
            if (drawer.mode === "edit" && drawer.team.id === deleteTarget.id) {
              setDrawer({ mode: "closed" });
            }
          } catch (err) {
            const msg = err instanceof ApiError ? err.message : "Could not delete team.";
            toast.error(msg);
          }
        }}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Delete ${selectedIds.length} ${selectedIds.length === 1 ? "team" : "teams"}?`}
        body={
          <>
            <p className="m-0">
              This permanently removes the {selectedIds.length === 1 ? "selected team" : `${selectedIds.length} selected teams`}.
              Existing estimates that reference {selectedIds.length === 1 ? "it" : "them"} keep their historical data.
            </p>
            <p className="m-0 mt-2 text-warm-gray-med" style={{ fontSize: 13 }}>
              Deactivate instead to hide {selectedIds.length === 1 ? "it" : "them"} from new estimates without losing the record.
            </p>
          </>
        }
        confirmLabel={`Delete ${selectedIds.length === 1 ? "team" : "teams"}`}
        destructive
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() =>
          new Promise<void>((resolve) => {
            bulkDelete.mutate(selectedIds, {
              onSuccess: (res) => {
                clearSelection();
                setBulkDeleteOpen(false);
                toast.success(
                  `${res.succeeded.length} deleted${res.failed.length ? `, ${res.failed.length} failed` : ""}.`,
                );
                resolve();
              },
              onError: () => {
                setBulkDeleteOpen(false);
                toast.error("Bulk delete failed.");
                resolve();
              },
            });
          })
        }
      />

    </>
  );
}
