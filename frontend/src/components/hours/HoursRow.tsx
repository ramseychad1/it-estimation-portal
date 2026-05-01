import { forwardRef, useImperativeHandle, useRef } from "react";
import { COLUMNS, rowSum, type RowKey, type RowValues } from "./columns";
import { HoursCell, type HoursCellHandle } from "./HoursCell";

export interface PhaseMeta {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
}

export interface HoursRowHandle {
  /** Focus the cell at the given column index. */
  focusColumn(colIndex: number): void;
}

interface HoursRowProps {
  phase: PhaseMeta;
  values: RowValues;
  onChange: (key: RowKey, next: number) => void;
  errors?: Partial<Record<RowKey, string>>;
  /**
   * Called when keyboard nav wants to leave this row vertically. The grid
   * resolves to the appropriate row + column.
   */
  onMoveVertical?: (dir: "up" | "down", colIndex: number) => void;
  /** Multi-cell paste anchored at the given column. */
  onPasteAt?: (colIndex: number, rows: (number | null)[][]) => void;
  disabled?: boolean;
}

/**
 * One row of the hours grid: phase metadata (name + display-order pip +
 * inactive pill) + 6 hour cells + row total. Row-internal horizontal
 * navigation (Left / Right at the edge) is handled by Tab / Shift-Tab
 * naturally; only vertical movement needs the grid's help via {@link
 * #onMoveVertical}.
 */
export const HoursRow = forwardRef<HoursRowHandle, HoursRowProps>(function HoursRow(
  { phase, values, onChange, errors, onMoveVertical, onPasteAt, disabled },
  ref,
) {
  const cellRefs = useRef<(HoursCellHandle | null)[]>([]);

  useImperativeHandle(ref, () => ({
    focusColumn(colIndex) {
      const target = cellRefs.current[colIndex];
      target?.focus();
    },
  }), []);

  function handleMove(colIndex: number, dir: "up" | "down" | "left" | "right") {
    if (dir === "up" || dir === "down") {
      onMoveVertical?.(dir, colIndex);
      return;
    }
    // Horizontal: hop within the row when there's a neighbour, else fall
    // through to vertical (e.g. left from col 0 wraps to col 5 of prev row,
    // right from col 5 wraps to col 0 of next row).
    if (dir === "left") {
      if (colIndex > 0) cellRefs.current[colIndex - 1]?.focus();
      else onMoveVertical?.("up", COLUMNS.length - 1);
    } else {
      if (colIndex < COLUMNS.length - 1) cellRefs.current[colIndex + 1]?.focus();
      else onMoveVertical?.("down", 0);
    }
  }

  return (
    <div
      role="row"
      className="grid items-center"
      style={{
        gridTemplateColumns: "minmax(180px, 1.2fr) repeat(6, 84px) 80px",
        gap: 8,
        padding: "8px 12px",
        background: phase.active ? "transparent" : "var(--color-warm-gray-light)",
        borderBottom: "1px solid var(--color-warm-gray-light)",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center text-near-black tabular-nums flex-shrink-0"
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--color-warm-gray-light)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {phase.displayOrder}
        </span>
        <span
          className="font-semibold text-near-black truncate"
          style={{ fontSize: 13 }}
          title={phase.name}
        >
          {phase.name}
        </span>
        {!phase.active && (
          <span
            className="inline-flex items-center text-warm-gray-med flex-shrink-0"
            style={{
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 500,
              background: "var(--color-white)",
              border: "1px solid var(--color-border-strong)",
            }}
          >
            Inactive
          </span>
        )}
      </div>

      {COLUMNS.map((col, i) => (
        <HoursCell
          key={col.key}
          ref={(h) => { cellRefs.current[i] = h; }}
          value={values[col.key]}
          onCommit={(next) => onChange(col.key, next)}
          isInactivePhase={!phase.active}
          error={errors?.[col.key] ?? null}
          ariaLabel={`${phase.name} ${col.label}`}
          onMove={(dir) => handleMove(i, dir)}
          onPasteMulti={(rows) => onPasteAt?.(i, rows)}
          disabled={disabled}
        />
      ))}

      <span
        className="text-warm-gray-med tabular-nums"
        style={{ fontSize: 12, textAlign: "right" }}
        aria-label={`Row total: ${rowSum(values)}`}
      >
        {rowSum(values)}
      </span>
    </div>
  );
});
