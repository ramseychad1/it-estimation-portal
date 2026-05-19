import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ListToolbar } from "../../components/ListToolbar";
import { SearchInput } from "../../components/SearchInput";
import { FilterDropdown } from "../../components/FilterDropdown";
import { KebabMenu, type KebabMenuItem } from "../../components/KebabMenu";
import { StatusBadge } from "../../components/StatusBadge";
import { ConfirmModal } from "../../components/ConfirmModal";
import { PrimaryButton } from "../../components/buttons";
import { useToast } from "../../components/Toast";
import { relativeTime } from "../../lib/relativeTime";
import {
  useAllProgramsQuery,
  useDeleteProgramMutation,
} from "../../lib/queries/programs";
import { useAllClientsQuery } from "../../lib/queries/clients";
import type { ProgramDto } from "../../lib/api/programs";
import { ProgramFormDrawer } from "./ProgramFormDrawer";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type DrawerState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; item: ProgramDto };

export function ProgramsPage() {
  useEffect(() => {
    document.title = "Programs — Estimator";
  }, []);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [clientFilter, setClientFilter] = useState<string>("ALL");
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<ProgramDto | null>(null);

  const query = useAllProgramsQuery();
  const clientsQuery = useAllClientsQuery();
  const deleteMutation = useDeleteProgramMutation();
  const toast = useToast();

  const clientOptions = useMemo(() => {
    const all = clientsQuery.data ?? [];
    return [
      { value: "ALL", label: "All clients" },
      ...all.map((c) => ({ value: String(c.id), label: c.name })),
    ];
  }, [clientsQuery.data]);

  const filteredItems = useMemo(() => {
    const all = query.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      if (status === "ACTIVE" && !p.active) return false;
      if (status === "INACTIVE" && p.active) return false;
      if (clientFilter !== "ALL" && String(p.clientId) !== clientFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.clientName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query.data, search, status, clientFilter]);

  function buildKebab(item: ProgramDto): KebabMenuItem[] {
    return [
      {
        label: "Edit",
        icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () => setDrawer({ mode: "edit", item }),
      },
      { kind: "divider" },
      {
        label: "Delete",
        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        destructive: true,
        onSelect: () => setDeleteTarget(item),
      },
    ];
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Programs" }]}
        title="Programs"
        subtitle="Manage the programs available when submitting estimate requests."
        actions={
          <PrimaryButton onClick={() => setDrawer({ mode: "create" })}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            New program
          </PrimaryButton>
        }
      />

      <hr className="my-6" style={{ height: 1, background: "var(--color-warm-gray-light)", border: 0 }} />

      <ListToolbar>
        <SearchInput
          placeholder="Search programs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterDropdown
          mode="single"
          label="Client"
          value={clientFilter}
          options={clientOptions}
          onChange={(next) => setClientFilter(next)}
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
          onChange={(next) => setStatus(next)}
        />
        <ListToolbar.Spacer />
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {filteredItems.length === 1 ? "1 program" : `${filteredItems.length} programs`}
        </span>
      </ListToolbar>

      <div
        className="bg-white overflow-hidden"
        style={{ border: "1px solid var(--color-border)", borderRadius: 6 }}
      >
        <table
          aria-label="Programs"
          className="w-full"
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Client</Th>
              <Th width={110}>Status</Th>
              <Th width={140}>Last updated</Th>
              <Th width={48} />
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--fg-2)" }}>
                  Loading…
                </td>
              </tr>
            )}
            {!query.isLoading && filteredItems.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 0 }}>
                  <EmptyState
                    variant="inline"
                    title="No programs match your filters"
                    action={
                      <button
                        type="button"
                        onClick={() => { setSearch(""); setStatus("ALL"); setClientFilter("ALL"); }}
                        className="text-near-black bg-transparent border-0 cursor-pointer hover:underline"
                        style={{ fontSize: 13 }}
                      >
                        Reset filters
                      </button>
                    }
                  />
                </td>
              </tr>
            )}
            {!query.isLoading &&
              filteredItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setDrawer({ mode: "edit", item })}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-warm-gray-light)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                  style={{ cursor: "pointer" }}
                >
                  <td style={cellStyle({})}>
                    <span className="font-semibold text-near-black">{item.name}</span>
                  </td>
                  <td style={cellStyle({})}>
                    <span style={{ color: "var(--fg-2)", fontSize: 13 }}>{item.clientName}</span>
                  </td>
                  <td style={cellStyle({ width: 110 })}>
                    {item.active ? (
                      <StatusBadge variant="active">Active</StatusBadge>
                    ) : (
                      <StatusBadge variant="inactive">Inactive</StatusBadge>
                    )}
                  </td>
                  <td style={cellStyle({ width: 140 })}>
                    <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
                      {relativeTime(item.updatedAt)}
                    </span>
                  </td>
                  <td style={cellStyle({ width: 48, textAlign: "right" })} onClick={(e) => e.stopPropagation()}>
                    <KebabMenu items={buildKebab(item)} ariaLabel={`Actions for ${item.name}`} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <ProgramFormDrawer
        open={drawer.mode === "create"}
        program={null}
        onClose={() => setDrawer({ mode: "closed" })}
      />
      <ProgramFormDrawer
        open={drawer.mode === "edit"}
        program={drawer.mode === "edit" ? drawer.item : null}
        onClose={() => setDrawer({ mode: "closed" })}
        onRequestDelete={(p) => { setDeleteTarget(p); setDrawer({ mode: "closed" }); }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete '${deleteTarget?.name ?? ""}'?`}
        body={
          <p className="m-0">
            This permanently removes <strong>{deleteTarget?.name}</strong>. Programs referenced
            by existing requests cannot be deleted — deactivate them instead.
          </p>
        }
        confirmLabel="Delete program"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            toast.success(`${deleteTarget.name} deleted.`);
            setDeleteTarget(null);
          } catch (err) {
            const msg =
              err instanceof ApiError && err.status === 409
                ? "Cannot delete — this program is used by existing requests. Deactivate it instead."
                : err instanceof ApiError
                  ? err.message
                  : "Could not delete program.";
            toast.error(msg);
            setDeleteTarget(null);
          }
        }}
      />
    </>
  );
}

function Th({ children, width }: { children?: React.ReactNode; width?: number }) {
  return (
    <th
      scope="col"
      style={{
        width,
        padding: "10px 14px",
        textAlign: "left",
        borderBottom: "1px solid var(--color-warm-gray-light)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--fg-2)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function cellStyle(extra: React.CSSProperties): React.CSSProperties {
  return {
    padding: "0 14px",
    height: 52,
    fontSize: 14,
    color: "var(--fg-1)",
    borderBottom: "1px solid var(--color-warm-gray-light)",
    verticalAlign: "middle",
    ...extra,
  };
}
