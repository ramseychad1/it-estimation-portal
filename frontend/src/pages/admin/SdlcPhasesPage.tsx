import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  History,
  Info,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ApiError } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ListToolbar } from "../../components/ListToolbar";
import { SearchInput } from "../../components/SearchInput";
import { FilterDropdown } from "../../components/FilterDropdown";
import { KebabMenu, type KebabMenuItem } from "../../components/KebabMenu";
import { StatusBadge } from "../../components/StatusBadge";
import { ConfirmModal } from "../../components/ConfirmModal";
import { InfoModal } from "../../components/InfoModal";
import { ColumnsToggle, useColumnsVisibility } from "../../components/ColumnsToggle";
import { DragHandle } from "../../components/DragHandle";
import { PrimaryButton } from "../../components/buttons";
import { UserCell } from "../../components/UserCell";
import { useToast } from "../../components/Toast";
import { relativeTime } from "../../lib/relativeTime";
import {
  getPhase,
  type PhaseStatusFilter,
  type SdlcPhaseDto,
  type SdlcPhaseListItem,
} from "../../lib/api/phases";
import {
  useActivatePhaseMutation,
  useDeactivatePhaseMutation,
  useDeletePhaseMutation,
  usePhasesQuery,
  useReorderPhasesMutation,
} from "../../lib/queries/phases";
import { SdlcPhaseFormDrawer } from "./SdlcPhaseFormDrawer";
import { SdlcPhaseHistoryDrawer } from "./SdlcPhaseHistoryDrawer";

type DrawerState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; phase: SdlcPhaseDto }
  | { mode: "history"; phase: SdlcPhaseDto };

const PHASES_COLUMN_DEFS = [
  { key: "order", label: "Order" },
  { key: "name", label: "Name" },
  { key: "mid", label: "Mid %" },
  { key: "description", label: "Description" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
  { key: "updatedAt", label: "Last updated" },
  { key: "updatedBy", label: "Updated by" },
];
const PHASES_REQUIRED_COLS = ["order", "name"];

export function SdlcPhasesPage() {
  useEffect(() => {
    document.title = "SDLC phases — Estimator";
  }, []);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PhaseStatusFilter>("ALL");
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<SdlcPhaseListItem | null>(null);
  const [hiddenCols, setHiddenCols] = useColumnsVisibility("phases", PHASES_REQUIRED_COLS);
  /** Phase 5b: surfaced when activation is blocked because active templates would need updating. */
  const [activationBlock, setActivationBlock] = useState<
    { phaseName: string; affectedCount: number } | null
  >(null);

  const phasesQuery = usePhasesQuery(status);
  const reorderMutation = useReorderPhasesMutation(status);
  const activateMutation = useActivatePhaseMutation();
  const deactivateMutation = useDeactivatePhaseMutation();
  const deleteMutation = useDeletePhaseMutation();
  const toast = useToast();

  // Local search filter; status filter goes through the server.
  const filteredItems = useMemo(() => {
    const all = phasesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [phasesQuery.data, search]);

  // Live Mid-% total across active phases — the estimator distribution should sum to 100%.
  const midTotalPct = useMemo(() => {
    const active = (phasesQuery.data ?? []).filter((p) => p.active);
    const sum = active.reduce((acc, p) => acc + (p.benchmarkMidPct ?? 0), 0);
    return round(sum * 100, 1);
  }, [phasesQuery.data]);
  const midOk = Math.abs(midTotalPct - 100) < 0.1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = filteredItems.map((p) => p.id);
    const oldIndex = ids.indexOf(active.id as number);
    const newIndex = ids.indexOf(over.id as number);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    reorderMutation.mutate(newOrder, {
      onError: () => toast.error("Could not save the new order. Reverted."),
    });
  }

  function announcementsFor(items: SdlcPhaseListItem[]) {
    const findName = (id: number | string) => items.find((p) => p.id === id)?.name ?? "Phase";
    const findPos = (id: number | string) => {
      const idx = items.findIndex((p) => p.id === id);
      return idx >= 0 ? `${idx + 1} of ${items.length}` : "unknown position";
    };
    return {
      onDragStart({ active }: { active: { id: number | string } }) {
        return `Phase '${findName(active.id)}' grabbed, position ${findPos(active.id)}.`;
      },
      onDragOver({
        active,
        over,
      }: {
        active: { id: number | string };
        over: { id: number | string } | null;
      }) {
        if (over) {
          return `Phase '${findName(active.id)}' is over position ${findPos(over.id)}.`;
        }
        return `Phase '${findName(active.id)}' is no longer over a droppable area.`;
      },
      onDragEnd({
        active,
        over,
      }: {
        active: { id: number | string };
        over: { id: number | string } | null;
      }) {
        if (over) {
          return `Phase '${findName(active.id)}' was dropped at position ${findPos(over.id)}.`;
        }
        return `Phase '${findName(active.id)}' was dropped.`;
      },
      onDragCancel({ active }: { active: { id: number | string } }) {
        return `Reordering phase '${findName(active.id)}' was cancelled.`;
      },
    };
  }

  async function openEdit(row: SdlcPhaseListItem) {
    try {
      const full = await getPhase(row.id);
      setDrawer({ mode: "edit", phase: full });
    } catch {
      toast.error("Could not load that phase.");
    }
  }

  async function openHistory(row: SdlcPhaseListItem) {
    try {
      const full = await getPhase(row.id);
      setDrawer({ mode: "history", phase: full });
    } catch {
      toast.error("Could not load that phase.");
    }
  }

  function buildKebab(row: SdlcPhaseListItem): KebabMenuItem[] {
    const items: KebabMenuItem[] = [
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
                onError: () => toast.error("Could not deactivate that phase."),
              }),
          }
        : {
            label: "Activate",
            icon: <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
            onSelect: () =>
              activateMutation.mutate(row.id, {
                onSuccess: () => toast.success(`${row.name} activated.`),
                onError: (err) => {
                  // Phase 5b: backend can refuse activation when active
                  // templates exist. Surface the InfoModal with the count
                  // rather than a generic error toast.
                  const blocked = parseTemplatesAffected(err);
                  if (blocked != null) {
                    setActivationBlock({ phaseName: row.name, affectedCount: blocked });
                  } else {
                    toast.error("Could not activate that phase.");
                  }
                },
              }),
          },
    ];
    if (!row.system) {
      items.push({
        label: "Delete",
        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        destructive: true,
        onSelect: () => setDeleteTarget(row),
      });
    }
    return items;
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "SDLC phases" }]}
        title="SDLC phases"
        subtitle="Define the phases used across estimate templates. Drag to reorder."
        actions={
          <PrimaryButton onClick={() => setDrawer({ mode: "create" })}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            New phase
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

      <ListToolbar>
        <SearchInput
          placeholder="Search phases…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
        <span
          title="Sum of Mid % across active phases — the estimator distribution should total 100%."
          style={{ fontSize: 12, color: midOk ? "var(--color-success-text, #166534)" : "var(--color-danger, #b91c1c)" }}
        >
          Mid total: {midTotalPct}%
        </span>
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {filteredItems.length === 1 ? "1 phase" : `${filteredItems.length} phases`}
        </span>
        <ColumnsToggle
          storageKey="phases"
          columns={PHASES_COLUMN_DEFS}
          required={PHASES_REQUIRED_COLS}
          hidden={hiddenCols}
          onChange={setHiddenCols}
        />
      </ListToolbar>

      <div
        className="bg-white overflow-hidden"
        style={{ border: "1px solid var(--color-border)", borderRadius: 6 }}
      >
        <table
          aria-label="SDLC phases"
          className="w-full"
          style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}
        >
          <thead>
            <tr>
              <Th width={32} />
              <Th width={56} center noSort>Order</Th>
              <Th>Name</Th>
              {!hiddenCols.has("mid") && (
                <Th width={88} center>
                  <span
                    title="Each phase's share of the total project. The estimator sizes the whole project from the dev-anchor phase, then distributes hours across phases by Mid %."
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "center", cursor: "help" }}
                  >
                    Mid %
                    <Info className="w-3 h-3" strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--fg-2)" }} />
                  </span>
                </Th>
              )}
              {!hiddenCols.has("description") && <Th>Description</Th>}
              {!hiddenCols.has("source") && <Th width={100}>Source</Th>}
              {!hiddenCols.has("status") && <Th width={110}>Status</Th>}
              {!hiddenCols.has("updatedAt") && <Th width={140}>Last updated</Th>}
              {!hiddenCols.has("updatedBy") && <Th width={180}>Updated by</Th>}
              <Th width={48} />
            </tr>
          </thead>
          <tbody>
            {phasesQuery.isLoading && (
              <tr>
                <td colSpan={10 - hiddenCols.size} style={{ padding: 32, textAlign: "center", color: "var(--fg-2)" }}>
                  Loading…
                </td>
              </tr>
            )}
            {!phasesQuery.isLoading && filteredItems.length === 0 && (
              <tr>
                <td colSpan={10 - hiddenCols.size} style={{ padding: 0 }}>
                  <EmptyState
                    variant="inline"
                    title="No phases match your filters"
                    action={
                      <button
                        type="button"
                        onClick={() => { setSearch(""); setStatus("ALL"); }}
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
            {!phasesQuery.isLoading && filteredItems.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                accessibility={{ announcements: announcementsFor(filteredItems) }}
              >
                <SortableContext
                  items={filteredItems.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredItems.map((phase) => (
                    <SortableRow
                      key={phase.id}
                      phase={phase}
                      onRowClick={() => void openEdit(phase)}
                      kebabItems={buildKebab(phase)}
                      hidden={hiddenCols}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </tbody>
        </table>
      </div>

      <SdlcPhaseFormDrawer
        open={drawer.mode === "create"}
        phase={null}
        onClose={() => setDrawer({ mode: "closed" })}
      />
      <SdlcPhaseFormDrawer
        open={drawer.mode === "edit"}
        phase={drawer.mode === "edit" ? drawer.phase : null}
        onClose={() => setDrawer({ mode: "closed" })}
        onShowHistory={(p) => setDrawer({ mode: "history", phase: p })}
        onRequestDelete={(p) =>
          setDeleteTarget({
            id: p.id,
            name: p.name,
            description: p.description,
            displayOrder: p.displayOrder,
            active: p.active,
            system: p.system,
            benchmarkLowPct: p.benchmarkLowPct,
            benchmarkMidPct: p.benchmarkMidPct,
            benchmarkHighPct: p.benchmarkHighPct,
            defaultOffshorePct: p.defaultOffshorePct,
            devAnchor: p.devAnchor,
            updatedAt: p.updatedAt,
            updatedBy: p.updatedBy,
          })
        }
      />
      <SdlcPhaseHistoryDrawer
        open={drawer.mode === "history"}
        phaseId={drawer.mode === "history" ? drawer.phase.id : null}
        phaseName={drawer.mode === "history" ? drawer.phase.name : undefined}
        onClose={() => setDrawer({ mode: "closed" })}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete '${deleteTarget?.name ?? ""}'?`}
        body={
          <>
            <p className="m-0">
              This permanently removes <strong>{deleteTarget?.name}</strong>. Estimates that
              already reference this phase keep their historical lines.
            </p>
            <p className="m-0 mt-2 text-warm-gray-med" style={{ fontSize: 13 }}>
              Deactivate instead if you want to hide it from new templates without losing the record.
            </p>
          </>
        }
        confirmLabel="Delete phase"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            toast.success(`${deleteTarget.name} deleted.`);
            setDeleteTarget(null);
            if (drawer.mode === "edit" && drawer.phase.id === deleteTarget.id) {
              setDrawer({ mode: "closed" });
            }
          } catch (err) {
            const msg = err instanceof ApiError ? err.message : "Could not delete phase.";
            toast.error(msg);
          }
        }}
      />

      <InfoModal
        open={activationBlock != null}
        title="Cannot activate phase"
        body={
          activationBlock && (
            <p className="m-0">
              Activating <strong>'{activationBlock.phaseName}'</strong> would
              affect{" "}
              <strong>
                {activationBlock.affectedCount} estimate template
                {activationBlock.affectedCount === 1 ? "" : "s"}
              </strong>
              . Update those templates to include this phase before
              activating.
            </p>
          )
        }
        secondaryLink={{
          label: "View affected templates →",
          // Phase 5b ships without a "templates that need review" filter on
          // the products list, so the link points at /catalog/products as a
          // starting point. Replace with a proper filter when one exists.
          onClick: () => {
            window.location.href = "/catalog/products?templateNeedsReview=true";
          },
        }}
        onClose={() => setActivationBlock(null)}
      />
    </>
  );
}

// ---- helpers ------------------------------------------------------------

/**
 * Detects the backend's TEMPLATES_WOULD_BE_AFFECTED 409 response and
 * extracts {@code affectedTemplateCount} from {@code fieldErrors}. Returns
 * the count when the error is the activation-guard rejection, {@code
 * null} for any other error so the generic toast path can run.
 */
function parseTemplatesAffected(err: unknown): number | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.body as
    | { error?: string; fieldErrors?: Record<string, string> }
    | null
    | undefined;
  if (!body || body.error !== "TEMPLATES_WOULD_BE_AFFECTED") return null;
  const raw = body.fieldErrors?.affectedTemplateCount;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ---- table primitives ---------------------------------------------------

function Th({
  children,
  width,
  center,
  noSort,
}: {
  children?: React.ReactNode;
  width?: number;
  center?: boolean;
  noSort?: boolean;
}) {
  return (
    <th
      scope="col"
      style={{
        width,
        padding: "10px 14px",
        textAlign: center ? "center" : "left",
        borderBottom: "1px solid var(--color-warm-gray-light)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: noSort ? "var(--fg-2)" : "var(--fg-2)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function SortableRow({
  phase,
  onRowClick,
  kebabItems,
  hidden,
}: {
  phase: SdlcPhaseListItem;
  onRowClick: () => void;
  kebabItems: KebabMenuItem[];
  hidden: Set<string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: phase.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? "#fff" : undefined,
    boxShadow: isDragging
      ? "inset 4px 0 0 var(--color-light-blue), 0 8px 20px rgba(39,37,31,0.12)"
      : undefined,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 2 : undefined,
    cursor: "pointer",
  };

  return (
    <tr
      ref={setNodeRef}
      data-row-id={phase.id}
      data-system={phase.system || undefined}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-row-skip]")) return;
        onRowClick();
      }}
      onMouseEnter={(e) => {
        if (!isDragging) (e.currentTarget as HTMLElement).style.background = "var(--color-warm-gray-light)";
      }}
      onMouseLeave={(e) => {
        if (!isDragging) (e.currentTarget as HTMLElement).style.background = "";
      }}
      style={style}
    >
      <td style={cellStyle({ width: 32, padding: "0 0 0 12px" })} data-row-skip>
        <DragHandle {...attributes} {...listeners} />
      </td>
      <td style={cellStyle({ width: 56, textAlign: "center" })}>
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center text-near-black tabular"
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: isDragging ? "var(--color-light-blue)" : "var(--color-warm-gray-light)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {phase.displayOrder}
        </span>
      </td>
      <td style={cellStyle({})}>
        <span className="font-semibold text-near-black">{phase.name}</span>
        {phase.devAnchor && (
          <span
            title="Dev-hours anchor"
            style={{
              marginLeft: 8,
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "1px 6px",
              borderRadius: 4,
              background: "var(--color-light-blue)",
              color: "var(--fg-1)",
              verticalAlign: "middle",
            }}
          >
            Anchor
          </span>
        )}
      </td>
      {!hidden.has("mid") && (
        <td style={cellStyle({ width: 72, textAlign: "center" })}>
          <span className="tabular text-near-black" style={{ fontSize: 13 }}>
            {pctLabel(phase.benchmarkMidPct)}
          </span>
        </td>
      )}
      {!hidden.has("description") && (
        <td style={cellStyle({})}>
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
            {phase.description ?? "—"}
          </span>
        </td>
      )}
      {!hidden.has("source") && (
        <td style={cellStyle({ width: 100 })}>
          {phase.system ? <StatusBadge variant="system">System</StatusBadge> : null}
        </td>
      )}
      {!hidden.has("status") && (
        <td style={cellStyle({ width: 110 })}>
          {phase.active ? (
            <StatusBadge variant="active">Active</StatusBadge>
          ) : (
            <StatusBadge variant="inactive">Inactive</StatusBadge>
          )}
        </td>
      )}
      {!hidden.has("updatedAt") && (
        <td style={cellStyle({ width: 140 })}>
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {relativeTime(phase.updatedAt)}
          </span>
        </td>
      )}
      {!hidden.has("updatedBy") && (
        <td style={cellStyle({ width: 180 })}>
          <UserCell userId={phase.updatedBy} />
        </td>
      )}
      <td style={cellStyle({ width: 48, textAlign: "right" })} data-row-skip>
        <KebabMenu items={kebabItems} ariaLabel={`Actions for ${phase.name}`} />
      </td>
    </tr>
  );
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** fraction (0.35) → "35%"; null → "—". */
function pctLabel(frac: number | null): string {
  return frac === null || frac === undefined ? "—" : `${round(frac * 100, 1)}%`;
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
