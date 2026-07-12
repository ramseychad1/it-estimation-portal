import { useEffect, useMemo, useState } from "react";
import {
  usePhaseBenchmarksQuery,
  useSavePhaseBenchmarksMutation,
} from "../../lib/queries/phases";
import type { PhaseBenchmarks } from "../../lib/api/phases";
import { useToast } from "../../components/Toast";
import { ApiError } from "../../lib/api";

/** Local edit row — percentages held as display strings ("35" = 35%). */
interface EditRow {
  id: number;
  name: string;
  active: boolean;
  low: string;
  target: string;
  high: string;
  offshore: string;
  devAnchor: boolean;
}

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** fraction (0.35) → percent display string ("35"); null → "". */
function fracToPct(f: number | null): string {
  if (f === null || f === undefined) return "";
  return String(round(f * 100, 2));
}

/** percent display string ("35") → fraction (0.35); blank → null. */
function pctToFrac(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return round(n / 100, 4);
}

function toEditRows(data: PhaseBenchmarks): EditRow[] {
  return data.phases.map((p) => ({
    id: p.id,
    name: p.name,
    active: p.active,
    low: fracToPct(p.benchmarkLowPct),
    target: fracToPct(p.benchmarkTargetPct),
    high: fracToPct(p.benchmarkHighPct),
    offshore: fracToPct(p.defaultOffshorePct),
    devAnchor: p.devAnchor,
  }));
}

export function PhaseBenchmarksSection() {
  const query = usePhaseBenchmarksQuery();
  const saveMutation = useSavePhaseBenchmarksMutation();
  const toast = useToast();

  const [rows, setRows] = useState<EditRow[]>([]);
  const [contingency, setContingency] = useState(""); // percent string
  const [populated, setPopulated] = useState(false);

  useEffect(() => {
    if (query.data && !populated) {
      setRows(toEditRows(query.data));
      setContingency(fracToPct(query.data.defaultContingencyPct));
      setPopulated(true);
    }
  }, [query.data, populated]);

  function patchRow(id: number, patch: Partial<EditRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function setAnchor(id: number) {
    setRows((prev) => prev.map((r) => ({ ...r, devAnchor: r.id === id })));
  }

  // ── Live derived state ──────────────────────────────────────────────────
  const targetSum = useMemo(
    () =>
      rows
        .filter((r) => r.active)
        .reduce((acc, r) => acc + (pctToFrac(r.target) ?? 0), 0),
    [rows],
  );
  const targetSumPct = round(targetSum * 100, 2);
  const sumOk = Math.abs(targetSumPct - 100) < 0.05;

  const anchorCount = rows.filter((r) => r.devAnchor).length;

  // Per-row: is target outside [low, high]? (guardrail warning, non-blocking)
  function rangeWarn(r: EditRow): boolean {
    const lo = pctToFrac(r.low);
    const hi = pctToFrac(r.high);
    const t = pctToFrac(r.target);
    if (t === null) return false;
    if (lo !== null && t < lo) return true;
    if (hi !== null && t > hi) return true;
    return false;
  }
  const lowGtHigh = rows.some((r) => {
    const lo = pctToFrac(r.low);
    const hi = pctToFrac(r.high);
    return lo !== null && hi !== null && lo > hi;
  });

  const contingencyValid = (() => {
    const f = pctToFrac(contingency);
    return f !== null && f >= 0 && f <= 1;
  })();

  const canSave =
    populated && anchorCount === 1 && !lowGtHigh && contingencyValid && !saveMutation.isPending;

  function handleSave() {
    if (anchorCount !== 1) {
      toast.error("Exactly one phase must be the dev-hours anchor.");
      return;
    }
    if (lowGtHigh) {
      toast.error("A phase has Low % greater than High %.");
      return;
    }
    if (!contingencyValid) {
      toast.error("Contingency must be between 0% and 100%.");
      return;
    }
    saveMutation.mutate(
      {
        defaultContingencyPct: pctToFrac(contingency) ?? 0,
        phases: rows.map((r) => ({
          id: r.id,
          benchmarkLowPct: pctToFrac(r.low),
          benchmarkTargetPct: pctToFrac(r.target),
          benchmarkHighPct: pctToFrac(r.high),
          defaultOffshorePct: pctToFrac(r.offshore) ?? 0,
          devAnchor: r.devAnchor,
        })),
      },
      {
        onSuccess: (fresh) => {
          setRows(toEditRows(fresh));
          setContingency(fracToPct(fresh.defaultContingencyPct));
          toast.success("Phase benchmarks saved.");
        },
        onError: (err) => {
          const msg =
            err instanceof ApiError
              ? (err.body as { message?: string })?.message ?? ""
              : "";
          toast.error(msg || "Failed to save benchmarks.");
        },
      },
    );
  }

  return (
    <section style={{ marginTop: 40 }}>
      <h2 className="font-semibold text-near-black" style={{ fontSize: 14, marginBottom: 6 }}>
        SDLC Phase Benchmarks
      </h2>
      <p className="text-warm-gray-med" style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        The dev-hours estimator back-solves total project hours from the{" "}
        <strong>dev anchor</strong> phase, then distributes them across phases by their{" "}
        <strong>mid %</strong>. Low/High % are the benchmark range (a guardrail, not a hard
        bound). All percentages are of the whole project.
      </p>

      {query.isLoading ? (
        <div className="text-warm-gray-med" style={{ fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          {/* Contingency */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-near-black)" }}>
              Default contingency %
            </label>
            <PctInput
              value={contingency}
              onChange={setContingency}
              invalid={!contingencyValid}
              width={64}
            />
            <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
              added on top of every generated estimate
            </span>
          </div>

          {/* Benchmark table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--color-warm-gray-med)" }}>
                  <th style={thStyle}>Phase</th>
                  <th style={thNumStyle}>Low %</th>
                  <th style={thNumStyle}>Mid %</th>
                  <th style={thNumStyle}>High %</th>
                  <th style={thNumStyle}>Offshore %</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Anchor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const warn = rangeWarn(r);
                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderTop: "1px solid var(--color-warm-gray-light)",
                        opacity: r.active ? 1 : 0.5,
                      }}
                    >
                      <td style={tdStyle}>
                        <span className="text-near-black">{r.name}</span>
                        {!r.active && (
                          <span className="text-warm-gray-med" style={{ fontSize: 11 }}>
                            {" "}(inactive)
                          </span>
                        )}
                      </td>
                      <td style={tdNumStyle}>
                        <PctInput value={r.low} onChange={(v) => patchRow(r.id, { low: v })} />
                      </td>
                      <td style={tdNumStyle}>
                        <PctInput
                          value={r.target}
                          onChange={(v) => patchRow(r.id, { target: v })}
                          warn={warn}
                        />
                      </td>
                      <td style={tdNumStyle}>
                        <PctInput value={r.high} onChange={(v) => patchRow(r.id, { high: v })} />
                      </td>
                      <td style={tdNumStyle}>
                        <PctInput
                          value={r.offshore}
                          onChange={(v) => patchRow(r.id, { offshore: v })}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <input
                          type="radio"
                          name="dev-anchor"
                          checked={r.devAnchor}
                          onChange={() => setAnchor(r.id)}
                          aria-label={`Set ${r.name} as dev anchor`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--color-warm-gray-light)" }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Active mid total</td>
                  <td style={tdNumStyle}></td>
                  <td style={{ ...tdNumStyle, fontWeight: 600, color: sumOk ? "var(--color-near-black)" : "var(--color-danger, #b91c1c)" }}>
                    {targetSumPct}%
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Validators */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {!sumOk && (
              <ValidatorLine ok={false}>
                Active mid %s sum to {targetSumPct}% — adjust to reach 100% for a balanced
                distribution.
              </ValidatorLine>
            )}
            {anchorCount !== 1 && (
              <ValidatorLine ok={false}>
                Select exactly one dev-hours anchor phase.
              </ValidatorLine>
            )}
            {lowGtHigh && (
              <ValidatorLine ok={false}>A phase has Low % greater than High %.</ValidatorLine>
            )}
            {sumOk && anchorCount === 1 && !lowGtHigh && (
              <ValidatorLine ok>Distribution balanced.</ValidatorLine>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="font-medium"
              style={{
                padding: "7px 16px",
                background: "var(--color-near-black, #1a1a1a)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                cursor: canSave ? "pointer" : "not-allowed",
                opacity: canSave ? 1 : 0.5,
              }}
            >
              {saveMutation.isPending ? "Saving…" : "Save Benchmarks"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ── Sub-components & styles ──────────────────────────────────────────────────

function PctInput({
  value,
  onChange,
  warn,
  invalid,
  width = 56,
}: {
  value: string;
  onChange: (v: string) => void;
  warn?: boolean;
  invalid?: boolean;
  width?: number;
}) {
  const borderColor = invalid
    ? "var(--color-danger, #b91c1c)"
    : warn
      ? "var(--color-warn-border, #fde68a)"
      : "var(--color-warm-gray-light)";
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width,
        padding: "5px 8px",
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        fontSize: 13,
        textAlign: "right",
        background: warn ? "var(--color-warn-bg, #fefce8)" : "#fff",
        boxSizing: "border-box",
      }}
    />
  );
}

function ValidatorLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: ok ? "var(--color-success-text, #166534)" : "var(--color-danger, #b91c1c)" }}>
      {ok ? "✓ " : "⚠ "}
      {children}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "6px 10px", fontWeight: 500, fontSize: 12 };
const thNumStyle: React.CSSProperties = { ...thStyle, textAlign: "right" };
const tdStyle: React.CSSProperties = { padding: "6px 10px", verticalAlign: "middle" };
const tdNumStyle: React.CSSProperties = { ...tdStyle, textAlign: "right" };
