import { ChevronDown, Columns3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClickOutside } from "../lib/useClickOutside";

export interface ColumnsToggleColumn {
  key: string;
  label: string;
}

interface ColumnsToggleProps {
  /** localStorage key for persisting hidden-columns state. */
  storageKey: string;
  /** Every column the table can render, in display order. */
  columns: ColumnsToggleColumn[];
  /**
   * Keys of columns that must always be visible (e.g. the primary "User" /
   * "Name" column). These columns are filtered out of the toggle list — the
   * user never sees a checkbox for them — and never end up in the hidden set.
   */
  required?: string[];
  /** Set of currently-hidden column keys. */
  hidden: Set<string>;
  onChange: (next: Set<string>) => void;
}

/**
 * Secondary-style button that opens a popover of column checkboxes. The
 * consuming page reads {@code hidden} via {@link useColumnsVisibility} and
 * filters its own column list before passing it to {@code <DataTable>}.
 *
 * Required columns are quietly enforced: they never appear in the popover
 * and never make it into the hidden set even if a stale localStorage entry
 * tries to hide them.
 */
export function ColumnsToggle({
  storageKey,
  columns,
  required = [],
  hidden,
  onChange,
}: ColumnsToggleProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapperRef, () => setOpen(false), open);
  void storageKey; // used by the hook below; passed in for traceability

  const requiredSet = useMemo(() => new Set(required), [required]);
  const toggleable = columns.filter((c) => !requiredSet.has(c.key));
  const hiddenCount = hidden.size;

  function toggle(key: string) {
    if (requiredSet.has(key)) return;
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-body font-medium text-near-black bg-white hover:bg-warm-gray-light focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ border: "1px solid var(--color-border-strong)" }}
      >
        <Columns3 className="w-3.5 h-3.5" strokeWidth={1.5} />
        Columns
        {hiddenCount > 0 && (
          <span
            className="text-warm-gray-med"
            style={{ fontSize: 11 }}
            data-testid="columns-toggle-hidden-count"
          >
            ({hiddenCount} hidden)
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Toggle columns"
          className="absolute right-0 mt-1 z-30 bg-white rounded-lg overflow-hidden"
          style={{
            minWidth: 220,
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-popover)",
            padding: "8px 0",
          }}
        >
          <div
            className="text-warm-gray-med uppercase font-medium px-3 pb-2"
            style={{ fontSize: 11, letterSpacing: "0.06em" }}
          >
            Visible columns
          </div>
          <ul className="m-0 p-0 list-none">
            {toggleable.map((col) => {
              const isHidden = hidden.has(col.key);
              return (
                <li key={col.key}>
                  <label
                    className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-warm-gray-light"
                    style={{ fontSize: 13 }}
                  >
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => toggle(col.key)}
                      style={{ accentColor: "var(--color-near-black)" }}
                    />
                    <span className="text-near-black">{col.label}</span>
                  </label>
                </li>
              );
            })}
            {toggleable.length === 0 && (
              <li className="text-warm-gray-med px-3 py-1.5" style={{ fontSize: 12 }}>
                Every column is required.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Hook that wires localStorage persistence around a hidden-columns state.
 * Returns {@code [hidden, setHidden]} like {@code useState}. Required
 * columns are stripped on read so a stale storage entry can't leave one
 * permanently hidden after a column becomes required.
 */
export function useColumnsVisibility(
  storageKey: string,
  required: string[] = [],
): [Set<string>, (next: Set<string>) => void] {
  const requiredSet = useMemo(() => new Set(required), [required]);

  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(`columns.${storageKey}`);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      const filtered = parsed.filter((k) => !requiredSet.has(k));
      return new Set(filtered);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `columns.${storageKey}`,
        JSON.stringify(Array.from(hidden)),
      );
    } catch {
      // localStorage might be disabled (private browsing); silently skip.
    }
  }, [storageKey, hidden]);

  return [hidden, setHidden];
}
