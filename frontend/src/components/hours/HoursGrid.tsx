import { useMemo, useRef } from "react";
import { COLUMNS, EMPTY_ROW, editableKeysForComplexity, fmtCost, fmtHrs, GRID_COLS, GRID_COLS_NO_COST, gridColsFor, type ColumnDef, type RowKey, type RowValues } from "./columns";
import { HoursRow, type HoursRowHandle, type PhaseMeta } from "./HoursRow";

/**
 * HoursGrid has two render modes — a discriminated union on {@code mode}.
 *
 * <p><b>{@code mode: "template-editor"} (default)</b> — Phase 5b's
 * original behaviour. Every cell is editable; paste handler fans across
 * the grid. The {@code values} map is the authoritative state.
 *
 * <p><b>{@code mode: "reviewer"}</b> — Phase 6b's review screen. The
 * grid receives an immutable {@code snapshot} (the per-phase L/M/H rows
 * copied at submission) PLUS a sparse {@code overrides} map (the
 * reviewer's per-cell tweaks). Only the cells in the chosen complexity
 * column become editable; the other four columns render dimmed and
 * read-only. An override marker + tooltip surfaces on overridden cells.
 *
 * <p>Internally, reviewer mode normalises {@code snapshot + overrides}
 * down to the same shape template-editor mode uses, so {@link HoursRow}
 * and {@link #applyPasteAt} stay identical for both modes.
 */
export type HoursGridProps = TemplateEditorProps | ReviewerProps;

export interface TemplateEditorProps {
  mode?: "template-editor";
  /** Phase metadata in render order (typically by display_order). */
  phases: PhaseMeta[];
  /** Cell values keyed by phase id. Missing phaseIds default to all-zeros. */
  values: Map<number, RowValues>;
  /** Per-cell errors keyed by phase id and column key. */
  errors?: Map<number, Partial<Record<RowKey, string>>>;
  onChange: (phaseId: number, key: RowKey, next: number) => void;
  onPaste?: (anchor: { phaseId: number; colIndex: number }, rows: (number | null)[][]) => void;
  disabled?: boolean;
  /** When provided, renders Total $ column and Estimate Total $ row. */
  onshoreRate?: number;
  offshoreRate?: number;
}

export interface ReviewerProps {
  mode: "reviewer";
  phases: PhaseMeta[];
  /**
   * Immutable snapshot copied at submission time. Reviewer mode never
   * writes to this — overrides go in the parallel {@link #overrides} map.
   */
  snapshot: Map<number, RowValues>;
  /**
   * Sparse per-cell overrides. Only the chosen-complexity cells can have
   * overrides (LineOverrideInput on the wire only carries
   * onshore/offshore override values, which apply to whichever column
   * the chosen complexity points at).
   */
  overrides: Map<number, Partial<RowValues>>;
  /**
   * The chosen complexity selects which column-pair becomes editable.
   * Null means the reviewer hasn't picked yet — every cell renders
   * read-only.
   */
  chosenComplexity: "LOW" | "MED" | "HIGH" | null;
  /**
   * Called when the reviewer commits a new override value or clicks the
   * per-cell revert icon (revert sends {@code null}).
   */
  onOverrideChange: (phaseId: number, key: RowKey, next: number | null) => void;
  /** Phase 6b doesn't use paste in reviewer mode; props omitted. */
  disabled?: boolean;
  /**
   * UX-3 progressive disclosure: when true and a complexity is chosen,
   * render only the chosen ONS/OFF column pair (relabelled "Onshore
   * Hours" / "Offshore Hours") and only that complexity's summary row.
   * The parent offers a "Show all columns" toggle to flip this off for
   * cross-complexity comparison. Ignored while chosenComplexity is null.
   */
  collapsed?: boolean;
}

/**
 * Grid header + body + grand-total footer. Owns the row-ref registry so
 * vertical navigation (Enter, ArrowUp/Down at edge, ArrowLeft/Right
 * wrapping past the row boundary) can focus the right cell on the
 * neighbouring row.
 *
 * The grid is stateless: the parent owns the source of truth (values in
 * template-editor mode; snapshot+overrides in reviewer mode) and reacts
 * to the corresponding callbacks. Keeping state external means the
 * detail page's "dirty" tracking and "Discard changes" reset both work
 * by simply re-rendering with a fresh values / overrides map.
 */
export function HoursGrid(props: HoursGridProps) {
  const isReviewer = props.mode === "reviewer";
  const onshoreRate = isReviewer ? undefined : (props as TemplateEditorProps).onshoreRate;
  const offshoreRate = isReviewer ? undefined : (props as TemplateEditorProps).offshoreRate;
  const showCost = onshoreRate != null && offshoreRate != null;

  // UX-3: collapsed reviewer view narrows to the chosen column pair.
  const isCollapsed =
    isReviewer &&
    !!(props as ReviewerProps).collapsed &&
    (props as ReviewerProps).chosenComplexity != null;
  const visibleColumns: ColumnDef[] = useMemo(() => {
    if (!isCollapsed) return COLUMNS;
    const editable = editableKeysForComplexity((props as ReviewerProps).chosenComplexity);
    return COLUMNS.filter((c) => editable.has(c.key)).map((c) => ({
      ...c,
      // Complexity is shown by the selector + summary row; the pair
      // headers read as plain hours columns (matches the approved view).
      label: c.group === "onshore" ? "Onshore Hours" : "Offshore Hours",
    }));
  }, [isCollapsed, isReviewer ? (props as ReviewerProps).chosenComplexity : null]);

  const gridCols = isCollapsed
    ? gridColsFor(visibleColumns.length, showCost)
    : showCost ? GRID_COLS : GRID_COLS_NO_COST;

  // In reviewer mode, derive the displayed values per phase by overlaying
  // overrides onto snapshot. Template-editor mode uses the values map
  // directly. The merged map drives both rendering AND grand-total
  // computation, so totals reflect overrides automatically.
  const displayedValues = useMemo<Map<number, RowValues>>(() => {
    if (!isReviewer) return (props as TemplateEditorProps).values;
    const r = props as ReviewerProps;
    const merged = new Map<number, RowValues>();
    for (const phase of r.phases) {
      const snap = r.snapshot.get(phase.id) ?? EMPTY_ROW;
      const ov = r.overrides.get(phase.id) ?? {};
      const row: RowValues = { ...snap };
      for (const col of COLUMNS) {
        const v = ov[col.key];
        if (v != null) row[col.key] = v;
      }
      merged.set(phase.id, row);
    }
    return merged;
  }, [isReviewer, props]);

  const phases = props.phases;
  const errors = isReviewer ? undefined : (props as TemplateEditorProps).errors;
  const disabled = props.disabled;

  const rowRefs = useRef<(HoursRowHandle | null)[]>([]);

  const grandTotals = useMemo(() => {
    const totals: RowValues = { ...EMPTY_ROW };
    for (const phase of phases) {
      const v = displayedValues.get(phase.id) ?? EMPTY_ROW;
      for (const col of COLUMNS) totals[col.key] += v[col.key] ?? 0;
    }
    return totals;
  }, [phases, displayedValues]);

  function handleVerticalMove(rowIndex: number, dir: "up" | "down", colIndex: number) {
    const target = dir === "up" ? rowIndex - 1 : rowIndex + 1;
    if (target < 0 || target >= phases.length) return;
    rowRefs.current[target]?.focusColumn(colIndex);
  }

  // Computed once per render: which column keys are editable in reviewer
  // mode. Empty Set when complexity is null or we're in template-editor
  // mode (the per-row code path checks isReviewer before consulting).
  const reviewerEditableKeys = isReviewer
    ? editableKeysForComplexity((props as ReviewerProps).chosenComplexity)
    : null;

  return (
    <div role="table" aria-label="Estimate template hours">
      {/* Header row */}
      <div
        role="rowheader"
        className="grid items-center text-warm-gray-med uppercase font-medium"
        style={{
          gridTemplateColumns: gridCols,
          gap: 8,
          padding: "10px 12px",
          fontSize: 11,
          letterSpacing: "0.06em",
          borderBottom: "1px solid var(--color-border-strong)",
        }}
      >
        <span>SDLC Phase</span>
        {visibleColumns.map((col) => {
          const highlighted = !isCollapsed && (reviewerEditableKeys?.has(col.key) ?? false);
          return (
            <span
              key={col.key}
              style={{
                textAlign: "right",
                color: highlighted ? "var(--color-near-black)" : undefined,
                background: highlighted ? "var(--color-light-blue-soft)" : undefined,
                padding: highlighted ? "2px 4px" : undefined,
                borderRadius: highlighted ? 3 : undefined,
              }}
            >
              {col.label}
            </span>
          );
        })}
        <span style={{ textAlign: "right" }}>Total Hrs</span>
        {showCost && <span style={{ textAlign: "right" }}>Est. Cost</span>}
      </div>

      {/* Body */}
      {phases.map((phase, idx) => {
        const phaseValues = displayedValues.get(phase.id) ?? EMPTY_ROW;
        const phaseErrors = errors?.get(phase.id);

        // Reviewer-mode per-row metadata — snapshot for tooltip, set of
        // overridden keys for the marker overlay, revert callback.
        let reviewer = undefined;
        if (isReviewer && reviewerEditableKeys) {
          const r = props as ReviewerProps;
          const snap = r.snapshot.get(phase.id) ?? EMPTY_ROW;
          const ov = r.overrides.get(phase.id) ?? {};
          const overriddenKeys = new Set<RowKey>();
          for (const col of COLUMNS) {
            // A cell is "overridden" only when (a) it's editable in the
            // chosen complexity AND (b) the override value differs from
            // the snapshot. Hides the marker on cells where the reviewer
            // typed the snapshot value back in (effectively a no-op).
            if (!reviewerEditableKeys.has(col.key)) continue;
            const v = ov[col.key];
            if (v != null && v !== snap[col.key]) overriddenKeys.add(col.key);
          }
          reviewer = {
            editableKeys: reviewerEditableKeys,
            snapshot: snap,
            overriddenKeys,
            onRevert: (key: RowKey) => r.onOverrideChange(phase.id, key, null),
          };
        }

        return (
          <HoursRow
            key={phase.id}
            ref={(h) => { rowRefs.current[idx] = h; }}
            phase={phase}
            values={phaseValues}
            errors={phaseErrors}
            disabled={disabled}
            onshoreRate={onshoreRate}
            offshoreRate={offshoreRate}
            onChange={(key, next) => {
              if (isReviewer) {
                const r = props as ReviewerProps;
                const snap = r.snapshot.get(phase.id) ?? EMPTY_ROW;
                // Typing the snapshot value back in clears the override
                // — the override marker disappears and the autosave PUT
                // sends null for that key.
                r.onOverrideChange(
                  phase.id, key,
                  next === snap[key] ? null : next,
                );
              } else {
                (props as TemplateEditorProps).onChange(phase.id, key, next);
              }
            }}
            onMoveVertical={(dir, colIndex) => handleVerticalMove(idx, dir, colIndex)}
            onPasteAt={isReviewer ? undefined : (colIndex, rows) =>
              (props as TemplateEditorProps).onPaste?.({ phaseId: phase.id, colIndex }, rows)
            }
            reviewer={reviewer}
            columns={isCollapsed ? visibleColumns : undefined}
            gridColsOverride={isCollapsed ? gridCols : undefined}
          />
        );
      })}

      {/* Per-complexity summary rows — Low / Med / High */}
      {([
        { label: "Low",  onsKey: "onshoreLow"  as RowKey, offKey: "offshoreLow"  as RowKey },
        { label: "Med",  onsKey: "onshoreMed"  as RowKey, offKey: "offshoreMed"  as RowKey },
        { label: "High", onsKey: "onshoreHigh" as RowKey, offKey: "offshoreHigh" as RowKey },
      ] as const)
        .filter(({ onsKey }) => !isCollapsed || (reviewerEditableKeys?.has(onsKey) ?? false))
        .map(({ label, onsKey, offKey }, i) => {
        const onsHrs = grandTotals[onsKey];
        const offHrs = grandTotals[offKey];
        const totalHrs = onsHrs + offHrs;
        const isReviewerActive = reviewerEditableKeys?.has(onsKey) ?? false;
        return (
          <div
            key={label}
            role="row"
            className="grid items-center"
            style={{
              gridTemplateColumns: gridCols,
              gap: 8,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-near-black)",
              background: isReviewerActive
                ? "rgba(187,221,230,0.18)"
                : "var(--color-warm-gray-light)",
              borderTop: i === 0
                ? "2px solid var(--color-border-strong)"
                : "1px solid var(--color-border-strong)",
            }}
          >
            <span
              className="uppercase"
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                color: isReviewerActive ? "var(--color-near-black)" : "var(--color-warm-gray-med)",
                fontWeight: isReviewerActive ? 700 : 600,
              }}
            >
              {label}
            </span>
            {visibleColumns.map((col) => {
              const isActive = col.key === onsKey || col.key === offKey;
              return (
                <span
                  key={col.key}
                  className="tabular-nums"
                  style={{
                    textAlign: "right",
                    color: isActive ? "var(--color-near-black)" : "var(--color-warm-gray-med)",
                    background: isActive ? "var(--color-light-blue-soft)" : undefined,
                    padding: isActive ? "2px 4px" : undefined,
                    borderRadius: isActive ? 3 : undefined,
                    fontWeight: isActive ? 700 : 400,
                  }}
                  aria-label={isActive ? `${label} ${col.label} total` : undefined}
                >
                  {isActive ? fmtHrs(grandTotals[col.key]) : "—"}
                </span>
              );
            })}
            <span
              className="tabular-nums"
              style={{ textAlign: "right", fontWeight: isReviewerActive ? 700 : 600 }}
              aria-label={`${label} total hours`}
            >
              {fmtHrs(totalHrs)}
            </span>
            {showCost && (
              <span
                className="tabular-nums"
                style={{ textAlign: "right", fontWeight: 600 }}
                aria-label={`${label} estimated cost`}
              >
                {fmtCost(onsHrs * onshoreRate! + offHrs * offshoreRate!)}
              </span>
            )}
          </div>
        );
      })}
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
