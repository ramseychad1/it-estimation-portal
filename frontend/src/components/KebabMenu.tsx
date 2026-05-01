import { MoreVertical } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useClickOutside } from "../lib/useClickOutside";

export type KebabMenuItem =
  | {
      kind?: "item";
      label: string;
      icon?: ReactNode;
      destructive?: boolean;
      disabled?: boolean;
      onSelect: () => void;
    }
  | { kind: "divider" };

interface KebabMenuProps {
  items: KebabMenuItem[];
  /** Accessible label for the trigger button. Defaults to "Row actions". */
  ariaLabel?: string;
}

export function KebabMenu({ items, ariaLabel = "Row actions" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // useClickOutside is a defence-in-depth net for cases like keyboard /
  // programmatic dismissal — the visible scrim below handles the normal
  // pointer path and stops it from reaching the underlying row.
  useClickOutside(wrapperRef, () => setOpen(false), open);

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          // Don't bubble to row-click handlers in DataTable.
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex items-center justify-center bg-transparent border-0 cursor-pointer text-warm-gray-med hover:text-near-black hover:bg-warm-gray-light rounded focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-blue"
        style={{ width: 28, height: 28 }}
      >
        <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
      </button>
      {open && (
        <>
          {/* Invisible click-eater scrim. Clicking anywhere outside the
              menu closes it AND stops the click from reaching the underlying
              row (which would otherwise open the edit drawer). */}
          <div
            data-row-skip
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="fixed inset-0 z-20"
            style={{ background: "transparent" }}
          />
          <div
            role="menu"
            data-row-skip
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 mt-1 z-30 bg-white rounded-lg overflow-hidden"
            style={{
              width: 180,
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-popover)",
              padding: "4px 0",
              fontSize: 13,
            }}
          >
            {items.map((it, idx) => {
              if (it.kind === "divider") {
                return (
                  <div
                    key={`d-${idx}`}
                    className="bg-warm-gray-light"
                    style={{ height: 1, margin: "4px 0" }}
                  />
                );
              }
              return (
                <button
                  key={`${it.label}-${idx}`}
                  type="button"
                  role="menuitem"
                  disabled={it.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    it.onSelect();
                  }}
                  className={`w-full text-left flex items-center gap-2.5 hover:bg-warm-gray-light disabled:opacity-50 disabled:cursor-not-allowed ${
                    it.destructive ? "text-cardinal-red" : "text-near-black"
                  }`}
                  style={{ padding: "7px 12px" }}
                >
                  {it.icon && (
                    <span
                      style={{
                        color: it.destructive ? "var(--color-cardinal-red)" : "var(--fg-2)",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      {it.icon}
                    </span>
                  )}
                  {it.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
