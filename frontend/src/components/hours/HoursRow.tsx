import { forwardRef, useImperativeHandle, useRef } from "react";
import { Undo2 } from "lucide-react";
import { COLUMNS, GRID_COLS, GRID_COLS_NO_COST, type RowKey, type RowValues } from "./columns";
import { HoursCell, type HoursCellHandle } from "./HoursCell";
import { ReadOnlyCell } from "./ReadOnlyCell";

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
  onMoveVertical?: (dir: "up" | "down", colIndex: number) => void;
  onPasteAt?: (colIndex: number, rows: (number | null)[][]) => void;
  disabled?: boolean;
  reviewer?: ReviewerCellMeta;
  /** Controls which gridTemplateColumns is used so body rows stay aligned with the footer. */
  onshoreRate?: number;
  offshoreRate?: number;
}

export interface ReviewerCellMeta {
  /**
   * The two RowKeys whose cells are editable (one Onshore + one Offshore
   * column at the chosen complexity). Empty Set means all cells are
   * read-only — typical when the reviewer hasn't picked a complexity yet.
   */
  editableKeys: ReadonlySet<RowKey>;
  /**
   * Snapshot values per RowKey — used to render the "Original: X"
   * tooltip on overridden cells. Always equals {@code values} when no
   * override is in play; differs when {@code values[key]} reflects an
   * override.
   */
  snapshot: RowValues;
  /**
   * Sparse map of overridden RowKeys → true. A cell is overridden when
   * the reviewer has typed a value that differs from the snapshot, OR
   * (equivalently) the backend's {@code onshore_override} /
   * {@code offshore_override} column for this row is non-null.
   */
  overriddenKeys: ReadonlySet<RowKey>;
  /** Called when the user clicks the per-cell revert icon. */
  onRevert: (key: RowKey) => void;
}

/**
 * One row of the hours grid: phase metadata (name + display-order pip +
 * inactive pill) + 6 hour cells + row total. Row-internal horizontal
 * navigation (Left / Right at the edge) is handled by Tab / Shift-Tab
 * naturally; only vertical movement needs the grid's help via {@link
 * #onMoveVertical}.
 */
export const HoursRow = forwardRef<HoursRowHandle, HoursRowProps>(function HoursRow(
  { phase, values, onChange, errors, onMoveVertical, onPasteAt, disabled, reviewer,
    onshoreRate, offshoreRate },
  ref,
) {
  const showCost = onshoreRate != null && offshoreRate != null;
  const gridCols = showCost ? GRID_COLS : GRID_COLS_NO_COST;
  const cellRefs = useRef<(HoursCellHandle | null)[]>([]);

  useImperativeHandle(ref, () => ({
    focusColumn(colIndex) {
      const target = cellRefs.current[colIndex];
      target?.focus();
    },
  }), []);

  function isEditable(colKey: RowKey): boolean {
    if (!reviewer) return true;
    return reviewer.editableKeys.has(colKey);
  }

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
        gridTemplateColumns: gridCols,
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

      {COLUMNS.map((col, i) => {
        const editable = isEditable(col.key);
        if (!editable) {
          // Reviewer-mode read-only cell: dimmed value, no input. Refs
          // intentionally not registered for read-only cells — keyboard
          // nav skips them naturally because they aren't focusable.
          return (
            <ReadOnlyCell
              key={col.key}
              value={values[col.key]}
              ariaLabel={`${phase.name} ${col.label}`}
              appearance="dimmed"
            />
          );
        }
        // Editable cell. In reviewer mode, attach an override marker
        // overlay + tooltip when the cell value diverges from snapshot.
        const overridden = reviewer?.overriddenKeys.has(col.key) ?? false;
        const overlay = overridden && reviewer ? (
          <OverrideMarker onRevert={() => reviewer.onRevert(col.key)} />
        ) : null;
        const title = overridden && reviewer
          ? `Original: ${formatNum(reviewer.snapshot[col.key])}`
          : undefined;
        return (
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
            overlay={overlay}
            title={title}
          />
        );
      })}

    </div>
  );
});

/**
 * Tiny revert-to-snapshot affordance, anchored bottom-right of the cell.
 * Visible only when an override is in play. Click clears the override.
 */
function OverrideMarker({ onRevert }: { onRevert: () => void }) {
  return (
    <button
      type="button"
      onClick={onRevert}
      aria-label="Revert override"
      title="Revert to original"
      className="inline-flex items-center justify-center cursor-pointer border-0"
      style={{
        position: "absolute",
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "var(--color-light-blue)",
        color: "var(--color-near-black)",
        boxShadow: "0 0 0 1px var(--color-white)",
      }}
    >
      <Undo2 style={{ width: 8, height: 8 }} strokeWidth={2.5} />
    </button>
  );
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}
