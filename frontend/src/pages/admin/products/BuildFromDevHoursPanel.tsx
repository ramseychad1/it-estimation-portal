import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { usePhasesQuery } from "../../../lib/queries/phases";
import { computeEstimate, type EstimatorPhaseInput } from "../../../lib/estimatorMath";
import { fmtHrs, type RowValues } from "../../../components/hours/columns";
import type { PhaseMeta } from "../../../components/hours/HoursRow";

interface Props {
  /** Phases in the template being edited (grid rows). */
  templatePhases: PhaseMeta[];
  /** Called live whenever the inputs produce a valid estimate — merges into the grid. */
  onGenerate: (values: Map<number, RowValues>) => void;
  disabled?: boolean;
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

/**
 * Inline, collapsible dev-hours estimator that lives above the template grid.
 * Editing any input recomputes and writes into the grid **live** — the SO
 * watches the grid, totals, and pricing preview move as they tweak, with no
 * Apply round-trip. "Discard changes" on the card reverts to the saved version.
 */
export function BuildFromDevHoursPanel({ templatePhases, onGenerate, disabled }: Props) {
  const [expanded, setExpanded] = useState(false);
  const phasesQuery = usePhasesQuery("ACTIVE");

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
  const [offshore, setOffshore] = useState<Map<number, string>>(new Map());

  // Seed offshore defaults for any phase not yet in the map (keeps SO edits).
  useEffect(() => {
    setOffshore((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const r of rows) {
        if (!next.has(r.id)) {
          next.set(r.id, fracToPct(r.bench?.defaultOffshorePct ?? 0));
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rows]);

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
  const canGenerate = anchorReady && devComplete;

  // Live drive: push the generated grid up whenever a valid estimate changes.
  useEffect(() => {
    if (!expanded || !canGenerate) return;
    onGenerate(result.values);
  }, [expanded, canGenerate, result, onGenerate]);

  return (
    <div style={{ border: "1px solid var(--color-warm-gray-light)", borderRadius: 8, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 bg-transparent border-0 cursor-pointer"
        style={{ padding: "12px 16px", textAlign: "left" }}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        )}
        <span className="font-semibold text-near-black" style={{ fontSize: 14 }}>
          Build from dev hours
        </span>
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          — estimate the grid from dev effort; it updates live as you tweak
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "4px 16px 20px", borderTop: "1px solid var(--color-warm-gray-light)" }}>
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
                margin: "12px 0",
              }}
            >
              No dev-hours anchor with a Mid % is set. Pick an anchor phase and give it a Mid % in
              the SDLC Phases benchmark editor before building.
            </div>
          )}

          {/* Dev hours + contingency */}
          <div style={{ marginTop: 16, marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--color-near-black)" }}>
            Dev hours{anchorRow ? ` — for ${anchorRow.name}` : ""}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <NumField label="Low" value={devLow} onChange={setDevLow} disabled={disabled} />
            <NumField label="Likely" value={devMid} onChange={setDevMid} disabled={disabled} />
            <NumField label="High" value={devHigh} onChange={setDevHigh} disabled={disabled} />
            <div style={{ width: 16 }} />
            <NumField label="Contingency %" value={contingency} onChange={setContingency} disabled={disabled} />
          </div>

          {/* Per-phase Mid % (read-only) + Offshore % (editable) */}
          <div style={{ marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--color-near-black)" }}>
            Phase distribution &amp; offshore split
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 92px", gap: "6px 12px", alignItems: "center", maxWidth: 440 }}>
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
                        disabled={disabled}
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

          {/* Generated totals + live note */}
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13 }}>
              <span className="text-warm-gray-med" style={{ fontWeight: 600, marginRight: 10 }}>
                Generated total hours
              </span>
              {canGenerate ? (
                <>
                  <span style={{ marginRight: 14 }}>Low <strong>{fmtHrs(result.totals.low)}</strong></span>
                  <span style={{ marginRight: 14 }}>Likely <strong>{fmtHrs(result.totals.mid)}</strong></span>
                  <span>High <strong>{fmtHrs(result.totals.high)}</strong></span>
                </>
              ) : (
                <span className="text-warm-gray-med">Enter Low, Likely, and High dev hours.</span>
              )}
            </div>
          </div>
          <p className="text-warm-gray-med" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            Editing any input regenerates the grid below. Fine-tune cells directly, or use{" "}
            <strong>Discard changes</strong> to revert to the saved version.
          </p>
        </div>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ width: 88 }}>
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
        disabled={disabled}
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
