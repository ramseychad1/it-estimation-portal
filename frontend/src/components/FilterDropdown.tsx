import { Check, ChevronDown, X } from "lucide-react";
import { useRef, useState, type ReactElement } from "react";
import { useClickOutside } from "../lib/useClickOutside";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface SingleProps<T extends string> {
  mode: "single";
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (next: T) => void;
}

interface MultiProps<T extends string> {
  mode: "multi";
  label: string;
  value: T[];
  options: FilterOption<T>[];
  onChange: (next: T[]) => void;
}

type FilterDropdownProps<T extends string> = SingleProps<T> | MultiProps<T>;

/**
 * Filter trigger styled as a secondary button with a chevron, plus a popover
 * menu of options.
 *
 * `mode="single"` — selecting an option fires onChange with that value and
 *                    closes the menu. The trigger label reads
 *                    "{label}: {selectedOption.label}".
 *
 * `mode="multi"`  — options are checkboxes; selecting an option toggles it
 *                    in the array without closing the menu. The trigger
 *                    reads "{label}: All" when the array is empty,
 *                    "{label}: {only.label}" with one selected, and
 *                    "{label}: {n} selected" with 2+. With 2+ selected,
 *                    chips render inline next to the trigger (each with ×
 *                    to remove a single value). The dropdown shows
 *                    "Clear all" when anything is selected.
 *
 * Implementation note: function overloads (rather than a discriminated
 * union as the props type) so JSX prop-type narrowing on `mode` works
 * reliably at call sites.
 */
export function FilterDropdown<T extends string>(props: SingleProps<T>): ReactElement;
export function FilterDropdown<T extends string>(props: MultiProps<T>): ReactElement;
export function FilterDropdown<T extends string>(props: FilterDropdownProps<T>): ReactElement {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapperRef, () => setOpen(false), open);

  const triggerLabel = computeTriggerLabel(props);

  return (
    <div ref={wrapperRef} className="inline-flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-body font-medium text-near-black bg-white hover:bg-warm-gray-light focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ border: "1px solid var(--color-border-strong)" }}
      >
        {triggerLabel}
        <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>

      {props.mode === "multi" && props.value.length >= 2 && (
        <Chips
          options={props.options}
          value={props.value}
          onRemove={(v) => props.onChange(props.value.filter((x) => x !== v))}
        />
      )}

      {open && (
        <div className="relative">
          <ul
            role="listbox"
            aria-label={props.label}
            aria-multiselectable={props.mode === "multi" || undefined}
            className="absolute right-0 mt-1 z-30 bg-white rounded-lg overflow-hidden"
            style={{
              top: 0,
              minWidth: 200,
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-popover)",
              padding: "4px 0",
            }}
          >
            {props.mode === "multi" && props.value.length > 0 && (
              <>
                <li>
                  <button
                    type="button"
                    onClick={() => props.onChange([])}
                    className="w-full text-left text-warm-gray-med hover:text-near-black hover:bg-warm-gray-light"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                  >
                    Clear all
                  </button>
                </li>
                <li
                  aria-hidden="true"
                  className="bg-warm-gray-light"
                  style={{ height: 1, margin: "4px 0" }}
                />
              </>
            )}
            {props.options.map((opt) =>
              props.mode === "single" ? (
                <SingleOption
                  key={opt.value}
                  option={opt}
                  active={opt.value === props.value}
                  onSelect={() => {
                    props.onChange(opt.value);
                    setOpen(false);
                  }}
                />
              ) : (
                <MultiOption
                  key={opt.value}
                  option={opt}
                  checked={props.value.includes(opt.value)}
                  onToggle={() => {
                    const checked = props.value.includes(opt.value);
                    props.onChange(
                      checked
                        ? props.value.filter((x) => x !== opt.value)
                        : [...props.value, opt.value],
                    );
                  }}
                />
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- helpers ------------------------------------------------------------

function computeTriggerLabel<T extends string>(props: FilterDropdownProps<T>): string {
  if (props.mode === "single") {
    const selected = props.options.find((o) => o.value === props.value);
    return `${props.label}: ${selected?.label ?? "—"}`;
  }
  if (props.value.length === 0) return `${props.label}: All`;
  if (props.value.length === 1) {
    const sel = props.options.find((o) => o.value === props.value[0]);
    return `${props.label}: ${sel?.label ?? props.value[0]}`;
  }
  return `${props.label}: ${props.value.length} selected`;
}

function SingleOption<T extends string>({
  option,
  active,
  onSelect,
}: {
  option: FilterOption<T>;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={active}
        onClick={onSelect}
        className={`w-full text-left px-3 py-1.5 text-small hover:bg-warm-gray-light ${
          active ? "font-semibold" : ""
        }`}
        style={{ color: "var(--fg-1)" }}
      >
        {option.label}
      </button>
    </li>
  );
}

function MultiOption<T extends string>({
  option,
  checked,
  onToggle,
}: {
  option: FilterOption<T>;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={checked}
        onClick={onToggle}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-small hover:bg-warm-gray-light"
        style={{ color: "var(--fg-1)" }}
      >
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: checked ? "var(--color-near-black)" : "#fff",
            border: `1px solid ${checked ? "var(--color-near-black)" : "var(--color-border-strong)"}`,
          }}
        >
          {checked && <Check className="w-3 h-3" strokeWidth={3} color="#fff" />}
        </span>
        {option.label}
      </button>
    </li>
  );
}

function Chips<T extends string>({
  options,
  value,
  onRemove,
}: {
  options: FilterOption<T>[];
  value: T[];
  onRemove: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      {value.map((v) => {
        const opt = options.find((o) => o.value === v);
        return (
          <span
            key={v}
            data-testid={`chip-${v}`}
            className="inline-flex items-center gap-1 text-near-black"
            style={{
              fontSize: 12,
              padding: "1px 4px 1px 8px",
              borderRadius: 4,
              background: "var(--color-light-blue-soft)",
              border: "1px solid rgba(187,221,230,0.7)",
              lineHeight: "20px",
            }}
          >
            {opt?.label ?? v}
            <button
              type="button"
              onClick={() => onRemove(v)}
              aria-label={`Remove ${opt?.label ?? v}`}
              className="inline-flex items-center justify-center bg-transparent border-0 cursor-pointer text-warm-gray-med hover:text-near-black rounded"
              style={{ width: 16, height: 16, padding: 0 }}
            >
              <X className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </span>
        );
      })}
    </div>
  );
}
