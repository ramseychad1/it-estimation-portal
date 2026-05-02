import { MoreVertical } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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

/** Width must match the rendered menu width below — used for right-edge alignment. */
const MENU_WIDTH = 180;

/**
 * Kebab dropdown rendered into a {@link createPortal portal} on
 * {@code document.body} so no ancestor's {@code overflow} can clip it.
 *
 * <p>Why a portal: when the kebab lives inside the {@link
 * /components/data-table/DataTable DataTable} (or any container with
 * {@code overflow-x-auto}, which the CSS spec auto-promotes to
 * {@code overflow: auto auto}), an absolutely-positioned dropdown gets
 * clipped at the table boundary. Last row's menu used to pop down ~5px
 * before being cut off. The portal escapes every clipping ancestor.
 *
 * <p>Position: {@code position: fixed} with viewport coordinates derived
 * from the trigger button's {@code getBoundingClientRect()}. Right-edge
 * aligned with the trigger (matches the prior visual layout).
 *
 * <p>Auto-close on scroll/resize: with fixed positioning, the menu
 * stays put while the page scrolls, which would visually detach it
 * from its row. Closing the menu on scroll matches OS-native popover
 * behaviour and is what users expect.
 */
export function KebabMenu({ items, ariaLabel = "Row actions" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // Close on outside-both-refs click. We can't use the shared
  // useClickOutside hook here because it takes a single ref — with the
  // dropdown portal'd into document.body, "outside the trigger" matches
  // every click on the menu, which would fire `setOpen(false)` on
  // mousedown and unmount the menu BEFORE the menuitem's click handler
  // can run. Combining the two refs here keeps the menu open until the
  // user clicks outside both.
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      const inTrigger = triggerRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (inTrigger || inMenu) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  // Recompute position when opened, on resize, and on any scroll.
  // useLayoutEffect to position the menu BEFORE the browser paints —
  // otherwise it briefly appears at (0,0) on the first frame.
  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const t = triggerRef.current;
      if (!t) return;
      const rect = t.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4, // mt-1 equivalent
        right: window.innerWidth - rect.right,
      });
    }
    reposition();
    window.addEventListener("resize", reposition);
    // capture-phase scroll listener catches scroll events from any
    // ancestor (e.g. the AppShell main content area), not just window.
    window.addEventListener("scroll", () => setOpen(false), { capture: true, once: true });
    return () => {
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  // Esc closes the menu (matches the rest of the app's popover affordances).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
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
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          data-row-skip
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-lg overflow-hidden"
          style={{
            position: "fixed",
            top: pos.top,
            right: pos.right,
            width: MENU_WIDTH,
            zIndex: 1000,
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
        </div>,
        document.body,
      )}
    </>
  );
}
