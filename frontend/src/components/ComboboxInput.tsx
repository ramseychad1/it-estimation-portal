import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";

export interface ComboboxOption {
  id: number;
  label: string;
}

interface ComboboxInputProps {
  id?: string;
  placeholder?: string;
  options: ComboboxOption[];
  value: number | null;
  onChange: (id: number) => void;
  onClear?: () => void;
  onCreateNew: () => void;
  createNewLabel: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Searchable combobox that filters options as the user types.
 * Always shows a "+New …" option at the bottom of the dropdown.
 */
export function ComboboxInput({
  id,
  placeholder = "Search…",
  options,
  value,
  onChange,
  onClear,
  onCreateNew,
  createNewLabel,
  disabled = false,
  required,
}: ComboboxInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.id === value)?.label ?? "";

  const filtered =
    search.trim() === ""
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  function handleFocus() {
    if (!disabled) {
      setOpen(true);
      setSearch("");
    }
  }

  function handleSelect(option: ComboboxOption) {
    onChange(option.id);
    setSearch("");
    setOpen(false);
  }

  function handleCreateNew() {
    setOpen(false);
    setSearch("");
    onCreateNew();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onClear?.();
    setSearch("");
    setOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const displayValue = open ? search : selectedLabel;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 32,
          border: `1px solid var(--color-border)`,
          borderRadius: 6,
          background: disabled ? "var(--color-warm-gray-light)" : "#fff",
          paddingLeft: 10,
          paddingRight: 6,
          gap: 4,
          cursor: disabled ? "not-allowed" : "text",
          opacity: disabled ? 0.7 : 1,
        }}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.focus();
            setOpen(true);
          }
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={displayValue}
          placeholder={value == null ? placeholder : ""}
          disabled={disabled}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          required={required}
          style={{
            flex: 1,
            border: 0,
            outline: "none",
            background: "transparent",
            fontSize: 13,
            color: "var(--color-near-black)",
            cursor: disabled ? "not-allowed" : "text",
            minWidth: 0,
          }}
        />
        {value != null && !disabled && onClear && (
          <button
            type="button"
            onMouseDown={handleClear}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              color: "var(--fg-2)",
              flexShrink: 0,
              padding: 0,
            }}
            aria-label="Clear selection"
          >
            <X style={{ width: 12, height: 12 }} strokeWidth={2} />
          </button>
        )}
        <ChevronDown
          style={{
            width: 14,
            height: 14,
            color: "var(--fg-2)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 140ms ease",
            pointerEvents: "none",
          }}
          strokeWidth={1.5}
        />
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#fff",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {filtered.length === 0 && (
            <div
              className="text-warm-gray-med"
              style={{ padding: "10px 12px", fontSize: 13 }}
            >
              No matches
            </div>
          )}
          {filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={() => handleSelect(option)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 12px",
                fontSize: 13,
                border: 0,
                background: value === option.id ? "var(--color-light-blue-soft)" : "transparent",
                color: "var(--color-near-black)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (value !== option.id)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--color-warm-gray-light)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  value === option.id ? "var(--color-light-blue-soft)" : "transparent";
              }}
            >
              {option.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--color-warm-gray-light)" }}>
            <button
              type="button"
              onMouseDown={handleCreateNew}
              className="inline-flex items-center font-medium"
              style={{
                display: "flex",
                width: "100%",
                textAlign: "left",
                padding: "9px 12px",
                fontSize: 13,
                border: 0,
                background: "transparent",
                color: "var(--color-near-black)",
                cursor: "pointer",
                gap: 6,
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--color-warm-gray-light)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
            >
              <Plus style={{ width: 13, height: 13, flexShrink: 0 }} strokeWidth={2.5} />
              {createNewLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
