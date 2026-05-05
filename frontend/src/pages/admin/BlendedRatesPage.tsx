import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, TrendingUp } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton } from "../../components/buttons";
import { StatusBadge } from "../../components/StatusBadge";
import { UserCell } from "../../components/UserCell";
import { KebabMenu, type KebabMenuItem } from "../../components/KebabMenu";
import { useRatesPageQuery } from "../../lib/queries/rates";
import { formatDelta, formatMoney } from "../../lib/money";
import type { BlendedRateListItem } from "../../lib/api/rates";
import { UpdateRatesModal } from "./UpdateRatesModal";
import { RateDetailsDrawer } from "./RateDetailsDrawer";

const PAGE_SIZE = 25;

function isoToHuman(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BlendedRatesPage() {
  useEffect(() => {
    document.title = "Blended Rates — Estimator";
  }, []);

  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<{
    onshoreRate: string;
    offshoreRate: string;
    note?: string | null;
  } | null>(null);
  const [drawerRate, setDrawerRate] = useState<BlendedRateListItem | null>(null);

  const ratesQuery = useRatesPageQuery({ page, size: PAGE_SIZE });
  const data = ratesQuery.data;
  const current = data?.current ?? null;
  const items = data?.history.items ?? [];
  const totalPages = data?.history.totalPages ?? 1;
  const totalElements = data?.history.totalElements ?? 0;

  const isDay1 = !ratesQuery.isLoading && totalElements === 0;

  // Compute previous rate per row for the drawer's delta display. Items
  // are ordered effective_date desc, created_at desc — the row at index i+1
  // is the previous-effective rate. (For the very last row, previous = null.)
  const previousByRowId = useMemo(() => {
    const map = new Map<number, BlendedRateListItem | null>();
    for (let i = 0; i < items.length; i++) {
      map.set(items[i].id, items[i + 1] ?? null);
    }
    return map;
  }, [items]);

  function openModalForUpdate(prefill: typeof modalPrefill = null) {
    setModalPrefill(prefill);
    setModalOpen(true);
  }

  function buildKebab(row: BlendedRateListItem): KebabMenuItem[] {
    return [
      {
        label: "View details",
        icon: <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () => setDrawerRate(row),
      },
    ];
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Blended rates" }]}
        title="Blended Rates"
        subtitle="Set the onshore and offshore hourly rates used to roll up estimate cost. Each change creates a new immutable history entry."
        actions={
          isDay1 ? null : (
            <PrimaryButton onClick={() => openModalForUpdate(null)}>
              Update Rates
            </PrimaryButton>
          )
        }
      />

      <hr
        className="my-6"
        style={{ height: 1, background: "var(--color-warm-gray-light)", border: 0 }}
      />

      {/* ---- two big rate cards --------------------------------------- */}
      <div className="grid grid-cols-2 gap-6">
        <RateCard
          eyebrow="Onshore"
          rate={current?.onshoreRate ?? null}
          isDay1={isDay1}
          effectiveDate={current?.effectiveDate}
          createdBy={current?.createdBy}
        />
        <RateCard
          eyebrow="Offshore"
          rate={current?.offshoreRate ?? null}
          isDay1={isDay1}
          effectiveDate={current?.effectiveDate}
          createdBy={current?.createdBy}
        />
      </div>

      {!isDay1 && current?.note && (
        <p className="text-warm-gray-med mt-3" style={{ fontSize: 12 }}>
          Latest note: <em>{current.note}</em>
        </p>
      )}
      {isDay1 && (
        <p className="text-warm-gray-med mt-3" style={{ fontSize: 12 }}>
          Set rates to begin estimating.
        </p>
      )}

      {/* ---- history --------------------------------------------------- */}
      <div className="flex items-baseline gap-2.5 mt-8 mb-3">
        <h2
          className="font-semibold text-near-black m-0"
          style={{ fontSize: 18, letterSpacing: "-0.005em" }}
        >
          Rate History
        </h2>
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {totalElements === 0 ? "" : `${totalElements} ${totalElements === 1 ? "change" : "changes"}`}
        </span>
      </div>

      <div
        className="bg-white overflow-hidden"
        style={{ border: "1px solid var(--color-border)", borderRadius: 6 }}
      >
        {isDay1 ? (
          <EmptyState
            icon={TrendingUp}
            title="No rates set yet"
            description="Set the workspace's first onshore and offshore blended rates to start estimating."
            action={
              <PrimaryButton onClick={() => openModalForUpdate(null)}>
                + Set Initial Rates
              </PrimaryButton>
            }
          />
        ) : (
          <table
            aria-label="Rate history"
            className="w-full"
            style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}
          >
            <thead>
              <tr>
                <Th>Effective date</Th>
                <Th align="right">Onshore</Th>
                <Th align="right">Δ</Th>
                <Th align="right">Offshore</Th>
                <Th align="right">Δ</Th>
                <Th>Changed by</Th>
                <Th>Note</Th>
                <Th width={48} />
              </tr>
            </thead>
            <tbody>
              {ratesQuery.isLoading && (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--fg-2)" }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!ratesQuery.isLoading &&
                items.map((row) => {
                  const previous = previousByRowId.get(row.id) ?? null;
                  const onDelta = previous
                    ? formatDelta(Number(previous.onshoreRate), Number(row.onshoreRate))
                    : null;
                  const offDelta = previous
                    ? formatDelta(Number(previous.offshoreRate), Number(row.offshoreRate))
                    : null;
                  return (
                    <tr
                      key={row.id}
                      data-row-id={row.id}
                      data-current={row.current || undefined}
                      className="cursor-pointer"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("[data-row-skip]")) return;
                        setDrawerRate(row);
                      }}
                      style={{
                        background: row.current ? "rgba(187, 221, 230, 0.18)" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!row.current) (e.currentTarget as HTMLElement).style.background = "var(--color-warm-gray-light)";
                        else (e.currentTarget as HTMLElement).style.background = "rgba(187, 221, 230, 0.32)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = row.current
                          ? "rgba(187, 221, 230, 0.18)"
                          : "";
                      }}
                    >
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          {isoToHuman(row.effectiveDate)}
                          {row.current && <StatusBadge variant="active">Current</StatusBadge>}
                          {row.scheduled && <StatusBadge variant="neutral">Scheduled</StatusBadge>}
                        </span>
                      </Td>
                      <Td align="right">${formatMoney(row.onshoreRate)}</Td>
                      <Td align="right"><DeltaCell delta={onDelta} /></Td>
                      <Td align="right">${formatMoney(row.offshoreRate)}</Td>
                      <Td align="right"><DeltaCell delta={offDelta} /></Td>
                      <Td><UserCell userId={row.createdBy} /></Td>
                      <Td>
                        <span
                          className="text-warm-gray-med"
                          style={{
                            display: "inline-block",
                            maxWidth: 220,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            verticalAlign: "middle",
                          }}
                        >
                          {row.note ?? "—"}
                        </span>
                      </Td>
                      <Td align="right">
                        <span data-row-skip>
                          <KebabMenu items={buildKebab(row)} ariaLabel={`Actions for ${isoToHuman(row.effectiveDate)}`} />
                        </span>
                      </Td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

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
              style={{ width: 28, height: 28, fontSize: 12, borderColor: "var(--color-border-strong)" }}
            >
              ‹
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="bg-white border rounded text-near-black disabled:text-warm-gray-med disabled:cursor-not-allowed"
              style={{ width: 28, height: 28, fontSize: 12, borderColor: "var(--color-border-strong)" }}
            >
              ›
            </button>
          </div>
        </div>
      )}

      <UpdateRatesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        currentOnshore={current ? Number(current.onshoreRate) : null}
        currentOffshore={current ? Number(current.offshoreRate) : null}
        prefill={modalPrefill}
      />

      <RateDetailsDrawer
        open={!!drawerRate}
        rate={drawerRate}
        previous={drawerRate ? previousByRowId.get(drawerRate.id) ?? null : null}
        onClose={() => setDrawerRate(null)}
        onRevert={(r) => {
          setDrawerRate(null);
          openModalForUpdate({
            onshoreRate: String(r.onshoreRate),
            offshoreRate: String(r.offshoreRate),
            note: `Reverting to the rates from ${isoToHuman(r.effectiveDate)}`,
          });
        }}
      />
    </>
  );
}

// ---- table primitives ---------------------------------------------------

function Th({
  children,
  width,
  align,
}: {
  children?: React.ReactNode;
  width?: number;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      style={{
        width,
        padding: "10px 14px",
        textAlign: align ?? "left",
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

function Td({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      style={{
        padding: "0 14px",
        height: 52,
        fontSize: 14,
        color: "var(--fg-1)",
        borderBottom: "1px solid var(--color-warm-gray-light)",
        verticalAlign: "middle",
        textAlign: align ?? "left",
      }}
    >
      {children}
    </td>
  );
}

function DeltaCell({ delta }: { delta: ReturnType<typeof formatDelta> | null }) {
  if (!delta) return <span className="text-warm-gray-med">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-warm-gray-med" style={{ fontSize: 13 }}>
      {delta.sign === "up" ? (
        <ChevronUp className="w-3 h-3" strokeWidth={1.5} />
      ) : delta.sign === "down" ? (
        <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
      ) : null}
      {delta.abs}
    </span>
  );
}

// ---- rate cards ----------------------------------------------------------

function RateCard({
  eyebrow,
  rate,
  isDay1,
  effectiveDate,
  createdBy,
}: {
  eyebrow: string;
  rate: string | null;
  isDay1: boolean;
  effectiveDate?: string;
  createdBy?: number | null;
}) {
  return (
    <div
      className="bg-white"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 6,
        padding: "24px 28px",
      }}
    >
      <div
        className="text-warm-gray-med uppercase font-medium"
        style={{ fontSize: 12, letterSpacing: "0.08em" }}
      >
        {eyebrow}
      </div>
      <div className="flex items-baseline gap-1.5 mt-3 tabular">
        {isDay1 || rate === null ? (
          <span
            className="text-warm-gray-med"
            style={{ fontSize: 24, fontStyle: "italic", lineHeight: 1 }}
          >
            Not set
          </span>
        ) : (
          <>
            <span
              className="text-near-black font-semibold"
              style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              ${formatMoney(rate)}
            </span>
            <span className="text-warm-gray-med" style={{ fontSize: 14 }}>
              /hour
            </span>
          </>
        )}
      </div>
      <div
        style={{ height: 1, background: "var(--color-warm-gray-light)", margin: "20px 0 14px" }}
      />
      <div
        className="flex items-center justify-between text-warm-gray-med"
        style={{ fontSize: 12 }}
      >
        {isDay1 ? (
          <span className="italic">Not yet set</span>
        ) : (
          <>
            <span>Effective since {effectiveDate ? isoToHuman(effectiveDate) : "—"}</span>
            <span className="inline-flex items-center gap-1.5">
              <span>Set by</span>
              <UserCell userId={createdBy ?? null} size={16} />
            </span>
          </>
        )}
      </div>
    </div>
  );
}
