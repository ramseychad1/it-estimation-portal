import { Calendar, ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useClickOutside } from "../lib/useClickOutside";

export type DatePreset =
  | "today"
  | "last7"
  | "last30"
  | "last90"
  | "thisYear"
  | "all"
  | "custom";

export interface DateRangeValue {
  preset: DatePreset;
  /** ISO yyyy-MM-dd. Only meaningful when preset === "custom". */
  from?: string;
  /** ISO yyyy-MM-dd. Only meaningful when preset === "custom". */
  to?: string;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: "Today",
  last7: "Last 7 days",
  last30: "Last 30 days",
  last90: "Last 90 days",
  thisYear: "This year",
  all: "All time",
  custom: "Custom range",
};

/**
 * Secondary-style trigger + popover with quick presets. "Custom range"
 * reveals two native date inputs and an Apply button.
 *
 * Resolution to API parameters happens at the call site via
 * {@link resolveRange} — keeps the picker UI-only and lets the page wire
 * its own server-shape (e.g. ISO instants vs bare dates).
 */
export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapperRef, () => setOpen(false), open);

  const [draftFrom, setDraftFrom] = useState(value.from ?? "");
  const [draftTo, setDraftTo] = useState(value.to ?? "");

  const triggerLabel = useMemo(() => {
    if (value.preset !== "custom") return PRESET_LABELS[value.preset];
    if (value.from && value.to) return `${value.from} – ${value.to}`;
    return PRESET_LABELS.custom;
  }, [value]);

  function applyPreset(preset: Exclude<DatePreset, "custom">) {
    onChange({ preset });
    setOpen(false);
  }

  function applyCustom() {
    if (!draftFrom || !draftTo) return;
    onChange({ preset: "custom", from: draftFrom, to: draftTo });
    setOpen(false);
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
        <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
        {triggerLabel}
        <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choose date range"
          className="absolute right-0 mt-1 z-30 bg-white rounded-lg overflow-hidden"
          style={{
            minWidth: 240,
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-popover)",
            padding: "8px 0",
          }}
        >
          <ul className="m-0 p-0 list-none">
            {(Object.keys(PRESET_LABELS) as DatePreset[])
              .filter((p) => p !== "custom")
              .map((preset) => (
                <li key={preset}>
                  <button
                    type="button"
                    onClick={() => applyPreset(preset as Exclude<DatePreset, "custom">)}
                    className={`w-full text-left px-3 py-1.5 text-small hover:bg-warm-gray-light ${
                      value.preset === preset ? "font-semibold" : ""
                    }`}
                    style={{ color: "var(--fg-1)" }}
                  >
                    {PRESET_LABELS[preset]}
                  </button>
                </li>
              ))}
            <li
              aria-hidden="true"
              className="bg-warm-gray-light"
              style={{ height: 1, margin: "4px 0" }}
            />
            <li>
              <div className="px-3 py-1.5 flex flex-col gap-2">
                <span
                  className="uppercase font-medium text-warm-gray-med"
                  style={{ fontSize: 11, letterSpacing: "0.06em" }}
                >
                  Custom range
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="From"
                    value={draftFrom}
                    onChange={(e) => setDraftFrom(e.target.value)}
                    className="border rounded px-2 py-1 text-small"
                    style={{ borderColor: "var(--color-border-strong)" }}
                  />
                  <span className="text-warm-gray-med">→</span>
                  <input
                    type="date"
                    aria-label="To"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="border rounded px-2 py-1 text-small"
                    style={{ borderColor: "var(--color-border-strong)" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={!draftFrom || !draftTo}
                  className="self-end inline-flex items-center justify-center h-7 px-3 rounded-md font-medium text-white text-small disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "var(--color-near-black)" }}
                >
                  Apply
                </button>
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Translate a {@link DateRangeValue} into ISO date strings the backend's
 * {@code parseInstant} accepts. Returns {@code null} for either bound when
 * the preset is "all time" — the API's "no from/to" path defaults to
 * "last 30 days," but here we want truly unbounded, so we anchor the
 * range at a sentinel start.
 */
export function resolveRange(
  value: DateRangeValue,
  now: Date = new Date(),
): { from?: string; to?: string } {
  function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
  function shift(days: number): Date {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return d;
  }
  switch (value.preset) {
    case "today":
      return { from: isoDate(now), to: isoDate(now) };
    case "last7":
      return { from: isoDate(shift(7)), to: isoDate(now) };
    case "last30":
      return { from: isoDate(shift(30)), to: isoDate(now) };
    case "last90":
      return { from: isoDate(shift(90)), to: isoDate(now) };
    case "thisYear": {
      const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      return { from: isoDate(yearStart), to: isoDate(now) };
    }
    case "all":
      // Anchor "all time" to a date guaranteed to predate the workspace.
      // Avoids triggering the server's default "last 30 days" fallback.
      // Update if workspace age ever exceeds this sentinel.
      return { from: "2020-01-01", to: isoDate(now) };
    case "custom":
      return { from: value.from, to: value.to };
  }
}
