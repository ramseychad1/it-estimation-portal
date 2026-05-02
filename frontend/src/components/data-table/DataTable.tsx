import type { ReactNode } from "react";

/**
 * Generic table built on the design system. Reused on every Admin and
 * Solution Owner list view.
 *
 * Columns are configured via {@link DataTableColumn} — each column can
 * provide a custom `render(row)` for full control over the cell, or rely
 * on the default text rendering of `accessor(row)`. Sort indicators show
 * up automatically when the column is `sortable`.
 *
 * Selection and sorting are CONTROLLED — the parent owns state and
 * passes change handlers. That keeps server-side sort and bulk actions
 * easy to wire from React Query.
 */

export type SortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Sort key + default cell rendering source. */
  accessor?: (row: T) => unknown;
  /** Custom cell renderer; takes precedence over accessor. */
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  width?: string | number;
  /**
   * If true, this column does not bubble row-click events. Use for the
   * actions kebab and the selection checkbox so clicking them doesn't
   * also open the edit drawer.
   */
  preventRowClick?: boolean;
}

export interface DataTableSelection<K extends string | number> {
  selectedIds: K[];
  onChange: (next: K[]) => void;
  /** When false, the checkbox column is hidden entirely. */
  enabled?: boolean;
}

export interface DataTableSort {
  by: string;
  dir: SortDirection;
  onChange: (by: string, dir: SortDirection) => void;
}

interface DataTableProps<T, K extends string | number> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => K;
  loading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  selection?: DataTableSelection<K>;
  sort?: DataTableSort;
  /** Optional className applied to the outer card wrapper. */
  className?: string;
  /** Stable accessible label for the table itself. */
  ariaLabel?: string;
}

export function DataTable<T, K extends string | number>({
  columns,
  rows,
  rowKey,
  loading,
  emptyState,
  onRowClick,
  selection,
  sort,
  className = "",
  ariaLabel,
}: DataTableProps<T, K>) {
  const showCheckbox = !!selection && selection.enabled !== false;
  const allIds = rows.map(rowKey);
  const selectedSet = new Set<K>(selection?.selectedIds ?? []);
  const allSelected = showCheckbox && rows.length > 0 && rows.every((r) => selectedSet.has(rowKey(r)));
  const someSelected =
    showCheckbox && !allSelected && rows.some((r) => selectedSet.has(rowKey(r)));

  function handleHeaderSort(col: DataTableColumn<T>) {
    if (!col.sortable || !sort) return;
    if (sort.by === col.key) {
      sort.onChange(col.key, sort.dir === "asc" ? "desc" : "asc");
    } else {
      sort.onChange(col.key, "asc");
    }
  }

  function toggleAll() {
    if (!selection) return;
    selection.onChange(allSelected ? [] : allIds);
  }

  function toggleRow(id: K) {
    if (!selection) return;
    if (selectedSet.has(id)) {
      selection.onChange(selection.selectedIds.filter((s) => s !== id));
    } else {
      selection.onChange([...selection.selectedIds, id]);
    }
  }

  return (
    // No `overflow-hidden` on this outer wrapper — it would clip absolutely-
    // positioned popovers from row children (KebabMenu, in particular: the
    // last row's menu pops below the table boundary and used to be cut off).
    // Horizontal overflow is handled by the inner `overflow-x-auto` so wide
    // tables still scroll independently.
    <div
      className={`bg-white ${className}`}
      style={{ border: "1px solid var(--color-border)", borderRadius: 6 }}
    >
      <div className="overflow-x-auto">
        <table
          aria-label={ariaLabel}
          className="w-full"
          style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}
        >
          <thead>
            <tr>
              {showCheckbox && (
                <th
                  scope="col"
                  style={{ width: 32, padding: "10px 0 10px 14px", borderBottom: "1px solid var(--color-warm-gray-light)" }}
                >
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    aria-label={allSelected ? "Deselect all rows" : "Select all rows"}
                  />
                </th>
              )}
              {columns.map((col) => {
                const isActiveSort = sort?.by === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{
                      width: col.width,
                      padding: "10px 14px",
                      textAlign: col.align ?? "left",
                      borderBottom: "1px solid var(--color-warm-gray-light)",
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--fg-2)",
                      whiteSpace: "nowrap",
                      userSelect: col.sortable ? "none" : undefined,
                      cursor: col.sortable ? "pointer" : "default",
                    }}
                    aria-sort={
                      isActiveSort
                        ? sort?.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : col.sortable
                          ? "none"
                          : undefined
                    }
                    onClick={() => handleHeaderSort(col)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        <span style={{ fontSize: 9, opacity: isActiveSort ? 1 : 0.5 }}>
                          {isActiveSort && sort?.dir === "desc" ? "▼" : "▲"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={columns.length + (showCheckbox ? 1 : 0)}
                  style={{ padding: 32, textAlign: "center", color: "var(--fg-2)" }}
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (showCheckbox ? 1 : 0)}
                  style={{ padding: 0 }}
                >
                  {emptyState ?? (
                    <div style={{ padding: 32, textAlign: "center", color: "var(--fg-2)" }}>
                      No records.
                    </div>
                  )}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => {
                const id = rowKey(row);
                const isSelected = selectedSet.has(id);
                const clickable = !!onRowClick;
                return (
                  <tr
                    key={id}
                    data-row-id={id}
                    data-selected={isSelected || undefined}
                    onClick={(e) => {
                      // Don't fire row click when interacting with cells
                      // marked preventRowClick (kebab, checkbox, etc.).
                      const target = e.target as HTMLElement;
                      if (target.closest("[data-row-skip]")) return;
                      if (clickable) onRowClick(row);
                    }}
                    style={{
                      cursor: clickable ? "pointer" : "default",
                      background: isSelected ? "rgba(187,221,230,0.30)" : undefined,
                      boxShadow: isSelected ? "inset 2px 0 0 var(--color-light-blue)" : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.background =
                          "var(--color-warm-gray-light)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.background = "";
                      }
                    }}
                  >
                    {showCheckbox && (
                      <td
                        style={{
                          width: 32,
                          padding: "0 0 0 14px",
                          height: 52,
                          verticalAlign: "middle",
                          borderBottom: "1px solid var(--color-warm-gray-light)",
                        }}
                        data-row-skip
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          aria-label={`Select row ${id}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        data-row-skip={col.preventRowClick || undefined}
                        style={{
                          padding: "0 14px",
                          height: 52,
                          fontSize: 14,
                          color: "var(--fg-1)",
                          textAlign: col.align ?? "left",
                          borderBottom: "1px solid var(--color-warm-gray-light)",
                          verticalAlign: "middle",
                        }}
                      >
                        {col.render
                          ? col.render(row)
                          : col.accessor
                            ? String(col.accessor(row) ?? "")
                            : ""}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- internal -----------------------------------------------------------

function Checkbox({
  checked,
  indeterminate,
  onChange,
  ...rest
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  "aria-label"?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate;
      }}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 16,
        height: 16,
        accentColor: "var(--color-near-black)",
        cursor: "pointer",
        margin: 0,
      }}
      {...rest}
    />
  );
}
