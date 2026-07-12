import { useEffect, useMemo, useState } from "react";
import { Drawer } from "../../../components/Drawer";
import { PrimaryButton, SecondaryButton } from "../../../components/buttons";
import { ConfirmModal } from "../../../components/ConfirmModal";
import { usePhasesQuery } from "../../../lib/queries/phases";
import { computeEstimate, type EstimatorPhaseInput } from "../../../lib/estimatorMath";
import { fmtHrs, type RowValues } from "../../../components/hours/columns";
import type { PhaseMeta } from "../../../components/hours/HoursRow";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Phases in the template being edited (grid rows). */
  templatePhases: PhaseMeta[];
  /** True when the grid already has non-zero values — Apply confirms first. */
  gridHasValues: boolean;
  onApply: (values: Map<number, RowValues>) => void;
}

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
const fracToPct = (f: number | null | undefined) =>
  f === null || f === undefined ? "" : String(round(f * 100, 2));
const pctToFrac = (s: string): number => {
  const n = Number(s.trim());
  return Number.isFinite(n) ? round(n / 100, 4) : 0;
};
const numOr0 = (s: string) => {
  const n = Number(s.trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function BuildFromDevHoursDrawer({
  open,
  onClose,
  templatePhases,
  gridHasValues,
  onApply,
}: Props) {
  const phasesQuery = usePhasesQuery("ACTIVE");

  // Benchmark data (Mid %, offshore default, anchor) keyed by phase id.
  const benchById = useMemo(() => {
    const m = new Map<
      number,
      { midPct: number | null; defaultOffshorePct: number; devAnchor: boolean }
    >();
    for (const p of phasesQuery.data ?? []) {
      m.set(p.id, {
        midPct: p.benchmarkMidPct,
        defaultOffshorePct: p.defaultOffshorePct,
        devAnchor: p.devAnchor,
      });
    }
    return m;
  }, [phasesQuery.data]);

  // Template phases, in display order, joined with their benchmark data.
  const rows = useMemo(
    () =>
      [...templatePhases]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((p) => ({ ...p, bench: benchById.get(p.id) })),
    [templatePhases, benchById],
  );

  const anchorRow = rows.find((r) => r.bench?.devAnchor);
  const anchorMid = anchorRow?.bench?.midPct ?? null;
  const anchorReady = anchorMid !== null && anchorMid > 0;

  const [devLow, setDevLow] = useState("");
  const [devMid, setDevMid] = useState("");
  const [devHigh, setDevHigh] = useState("");
  const [contingency, setContingency] = useState("10");
  // Per-phase offshore % (display strings), pre-filled from each phase default.
  const [offshore, setOffshore] = useState<Map<number, string>>(new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // (Re)seed offshore inputs from phase defaults whenever the drawer opens.
  useEffect(() => {
    if (!open) return;
    const next = new Map<number, string>();
    for (const r of rows) {
      next.set(r.id, fracToPct(r.bench?.defaultOffshorePct ?? 0));
    }
    setOffshore(next);
  }, [open, rows]);

  const inputs = useMemo(
    () => ({
      devLow: numOr0(devLow),
      devMid: numOr0(devMid),
      devHigh: numOr0(devHigh),
      contingencyPct: pctToFrac(contingency),
      phases: rows.map<EstimatorPhaseInput>((r) => ({
        phaseId: r.id,
        midPct: r.bench?.midPct ?? null,
        offshorePct: pctToFrac(offshore.get(r.id) ?? "0"),
        isAnchor: r.bench?.devAnchor ?? false,
      })),
    }),
    [devLow, devMid, devHigh, contingency, offshore, rows],
  );

  const result = useMemo(() => computeEstimate(inputs), [inputs]);

  const devComplete = numOr0(devLow) > 0 && numOr0(devMid) > 0 && numOr0(devHigh) > 0;
  const canApply = anchorReady && devComplete;

  function doApply() {
    onApply(result.values);
    onClose();
  }

  function handleApplyClick() {
    if (gridHasValues) setConfirmOpen(true);
    else doApply();
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Build from dev hours"
        subtitle="Estimate the whole template from development effort, then fine-tune in the grid."
        width={560}
        footer={
          <>
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleApplyClick} disabled={!canApply}>
              Apply to grid
            </PrimaryButton>
          </>
        }
      >
        {!anchorReady && (
          <div
            role="note"
            style={{
              background: "var(--color-warn-bg, #fefce8)",
              border: "1px solid var(--color-warn-border, #fde68a)",
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              color: "#92400e",
              marginBottom: 16,
            }}
          >
            No dev-hours anchor with a Mid % is set. Pick an anchor phase and give it a Mid % in
            the SDLC Phases benchmark editor before building.
          </div>
        )}

        {/* Dev hours + contingency */}
        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--color-near-black)" }}>
          Dev hours{anchorRow ? ` — for ${anchorRow.name}` : ""}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <NumField label="Low" value={devLow} onChange={setDevLow} />
          <NumField label="Likely" value={devMid} onChange={setDevMid} />
          <NumField label="High" value={devHigh} onChange={setDevHigh} />
        </div>
        <div style={{ marginTop: 12, maxWidth: 160 }}>
          <NumField label="Contingency %" value={contingency} onChange={setContingency} />
        </div>

        {/* Per-phase Mid % (read-only) + Offshore % (editable) */}
        <div
          style={{ marginTop: 24, marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--color-near-black)" }}
        >
          Phase distribution &amp; offshore split
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 92px", gap: "6px 12px", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-warm-gray-med)" }}>Phase</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-warm-gray-med)", textAlign: "right" }}>Mid %</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-warm-gray-med)", textAlign: "right" }}>Offshore %</div>
          {rows.map((r) => {
            const noBench = !r.bench || r.bench.midPct === null;
            return (
              <div key={r.id} style={{ display: "contents" }}>
                <div style={{ fontSize: 13, color: noBench ? "var(--color-warm-gray-med)" : "var(--fg-1)" }}>
                  {r.name}
                  {r.bench?.devAnchor && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: "var(--color-light-blue)",
                        color: "var(--fg-1)",
                      }}
                    >
                      Anchor
                    </span>
                  )}
                  {noBench && <span style={{ fontSize: 11 }}> — no benchmark</span>}
                </div>
                <div style={{ fontSize: 13, textAlign: "right", color: "var(--color-warm-gray-med)" }}>
                  {noBench ? "—" : `${round((r.bench!.midPct ?? 0) * 100, 1)}%`}
                </div>
                <div style={{ textAlign: "right" }}>
                  {noBench ? (
                    <span style={{ fontSize: 13, color: "var(--color-warm-gray-med)" }}>—</span>
                  ) : (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={offshore.get(r.id) ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOffshore((prev) => new Map(prev).set(r.id, v));
                      }}
                      style={{
                        width: 72,
                        padding: "5px 8px",
                        border: "1px solid var(--color-warm-gray-light)",
                        borderRadius: 6,
                        fontSize: 13,
                        textAlign: "right",
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Generated totals preview */}
        <div
          style={{
            marginTop: 24,
            padding: "12px 14px",
            borderRadius: 8,
            background: "var(--color-warm-gray-lightest, #f5f5f4)",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--color-near-black)" }}>
            Generated total hours
          </div>
          {canApply ? (
            <div style={{ display: "flex", gap: 20 }}>
              <span>Low <strong>{fmtHrs(result.totals.low)}</strong></span>
              <span>Likely <strong>{fmtHrs(result.totals.mid)}</strong></span>
              <span>High <strong>{fmtHrs(result.totals.high)}</strong></span>
            </div>
          ) : (
            <div style={{ color: "var(--color-warm-gray-med)" }}>
              Enter Low, Likely, and High dev hours to preview.
            </div>
          )}
          {anchorRow && contingency.trim() !== "" && numOr0(contingency) >= 0 && (
            <div style={{ color: "var(--color-warm-gray-med)", fontSize: 12, marginTop: 6 }}>
              Contingency inflates every phase — {anchorRow.name} lands above your entered dev hours.
            </div>
          )}
        </div>
      </Drawer>

      <ConfirmModal
        open={confirmOpen}
        title="Replace grid values?"
        body="This overwrites the current hours in the grid with the generated estimate. You can still adjust cells afterward and discard before saving."
        confirmLabel="Replace"
        cancelLabel="Cancel"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          doApply();
        }}
      />
    </>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        style={{ fontSize: 11, fontWeight: 500, display: "block", marginBottom: 4, color: "var(--color-near-black)" }}
      >
        {label}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "6px 10px",
          border: "1px solid var(--color-warm-gray-light)",
          borderRadius: 6,
          fontSize: 13,
          textAlign: "right",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
