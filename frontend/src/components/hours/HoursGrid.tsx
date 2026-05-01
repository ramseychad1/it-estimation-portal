import { useMemo, useRef } from "react";
import { COLUMNS, EMPTY_ROW, type RowKey, type RowValues } from "./columns";
import { HoursRow, type HoursRowHandle, type PhaseMeta } from "./HoursRow";

export interface HoursGridProps {
  /** Phase metadata in render order (typically by display_order). */
  phases: PhaseMeta[];
  /** Cell values keyed by phase id. Missing phaseIds default to all-zeros. */
  values: Map<number, RowValues>;
  /** Per-cell errors keyed by phase id and column key. */
  errors?: Map<number, Partial<Record<RowKey, string>>>;
  onChange: (phaseId: number, key: RowKey, next: number) => void;
  /**
   * Multi-cell paste origin: phase id + column index of the focused cell.
   * Grid distributes the pasted 2D array starting at this anchor, fanning
   * right and down. Out-of-range values are silently dropped.
   */
  onPaste?: (anchor: { phaseId: number; colIndex: number }, rows: (number | null)[][]) => void;
  disabled?: boolean;
}

/**
 * Grid header + body + grand-total footer. Owns the row-ref registry so
 * vertical navigation (Enter, ArrowUp/Down at edge, ArrowLeft/Right
 * wrapping past the row boundary) can focus the right cell on the
 * neighbouring row.
 *
 * The grid is stateless: the parent owns {@code values} and reacts to
 * {@code onChange} / {@code onPaste}. Keeping state external means the
 * detail page's "dirty" tracking and "Discard changes" reset both work
 * by simply re-rendering with a fresh values map.
 */
export function HoursGrid({
  phases,
  values,
  errors,
  onChange,
  onPaste,
  disabled,
}: HoursGridProps) {
  const rowRefs = useRef<(HoursRowHandle | null)[]>([]);

  const grandTotals = useMemo(() => {
    const totals: RowValues = { ...EMPTY_ROW };
    for (const phase of phases) {
      const v = values.get(phase.id) ?? EMPTY_ROW;
      for (const col of COLUMNS) totals[col.key] += v[col.key] ?? 0;
    }
    return totals;
  }, [phases, values]);

  function handleVerticalMove(rowIndex: number, dir: "up" | "down", colIndex: number) {
    const target = dir === "up" ? rowIndex - 1 : rowIndex + 1;
    if (target < 0 || target >= phases.length) return;
    rowRefs.current[target]?.focusColumn(colIndex);
  }

  return (
    <div role="table" aria-label="Estimate template hours">
      {/* Header row */}
      <div
        role="rowheader"
        className="grid items-center text-warm-gray-med uppercase font-medium"
        style={{
          gridTemplateColumns: "minmax(180px, 1.2fr) repeat(6, 84px) 80px",
          gap: 8,
          padding: "10px 12px",
          fontSize: 11,
          letterSpacing: "0.06em",
          borderBottom: "1px solid var(--color-border-strong)",
        }}
      >
        <span>SDLC Phase</span>
        {COLUMNS.map((col) => (
          <span key={col.key} style={{ textAlign: "right" }}>{col.label}</span>
        ))}
        <span style={{ textAlign: "right" }}>Row total</span>
      </div>

      {/* Body */}
      {phases.map((phase, idx) => {
        const phaseValues = values.get(phase.id) ?? EMPTY_ROW;
        const phaseErrors = errors?.get(phase.id);
        return (
          <HoursRow
            key={phase.id}
            ref={(h) => { rowRefs.current[idx] = h; }}
            phase={phase}
            values={phaseValues}
            errors={phaseErrors}
            disabled={disabled}
            onChange={(key, next) => onChange(phase.id, key, next)}
            onMoveVertical={(dir, colIndex) => handleVerticalMove(idx, dir, colIndex)}
            onPasteAt={(colIndex, rows) =>
              onPaste?.({ phaseId: phase.id, colIndex }, rows)
            }
          />
        );
      })}

      {/* Grand total */}
      <div
        role="row"
        className="grid items-center"
        style={{
          gridTemplateColumns: "minmax(180px, 1.2fr) repeat(6, 84px) 80px",
          gap: 8,
          padding: "10px 12px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-near-black)",
          background: "var(--color-warm-gray-light)",
          borderTop: "1px solid var(--color-border-strong)",
        }}
      >
        <span className="uppercase" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
          Grand total
        </span>
        {COLUMNS.map((col) => (
          <span
            key={col.key}
            className="tabular-nums"
            style={{ textAlign: "right" }}
            aria-label={`${col.label} total`}
          >
            {grandTotals[col.key]}
          </span>
        ))}
        <span
          className="tabular-nums"
          style={{ textAlign: "right" }}
          aria-label="Grid total"
        >
          {COLUMNS.reduce((sum, c) => sum + grandTotals[c.key], 0)}
        </span>
      </div>
    </div>
  );
}

/**
 * Distribute a parsed TSV grid across the values map starting at the
 * given anchor. Non-numeric cells (`null` from the parser) are skipped
 * — the cell keeps its previous value. Out-of-range cells are silently
 * dropped.
 *
 * Exported so the page can call it directly from {@code onPaste} without
 * the grid having to know about the values map shape.
 */
export function applyPasteAt(
  anchor: { phaseId: number; colIndex: number },
  pastedRows: (number | null)[][],
  phases: PhaseMeta[],
  values: Map<number, RowValues>,
): Map<number, RowValues> {
  const next = new Map(values);
  const startRow = phases.findIndex((p) => p.id === anchor.phaseId);
  if (startRow < 0) return next;

  for (let r = 0; r < pastedRows.length; r++) {
    const targetRow = startRow + r;
    if (targetRow >= phases.length) break;
    const phase = phases[targetRow];
    const rowValues: RowValues = { ...(next.get(phase.id) ?? EMPTY_ROW) };
    let dirty = false;
    for (let c = 0; c < pastedRows[r].length; c++) {
      const targetCol = anchor.colIndex + c;
      if (targetCol >= COLUMNS.length) break;
      const cell = pastedRows[r][c];
      if (cell == null || cell < 0) continue; // skip non-numeric or negative
      rowValues[COLUMNS[targetCol].key] = cell;
      dirty = true;
    }
    if (dirty) next.set(phase.id, rowValues);
  }
  return next;
}
