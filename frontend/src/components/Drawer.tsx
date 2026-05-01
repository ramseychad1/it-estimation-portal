import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ConfirmModal } from "./ConfirmModal";

interface DrawerProps {
  open: boolean;
  /** Called once the drawer is allowed to close (after dirty-state check, if any). */
  onClose: () => void;
  /**
   * When true, attempts to close (Esc, X, scrim click) prompt the user
   * with a "Discard changes?" confirm before actually calling onClose.
   * Save buttons should call onClose directly, bypassing the prompt.
   */
  isDirty?: boolean;
  title: ReactNode;
  /** Optional eyebrow / subtitle under the title (12px warm gray). */
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky footer slot. */
  footer?: ReactNode;
  /** Defaults to 480px. */
  width?: number;
}

/**
 * Right-side drawer. Focus traps inside the panel while open, returns focus
 * to the previously-focused element on close, closes on Esc / scrim click,
 * and (when isDirty) routes those close paths through a confirm modal.
 */
export function Drawer({
  open,
  onClose,
  isDirty = false,
  title,
  subtitle,
  children,
  footer,
  width = 480,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Focus management: capture trigger, focus panel, restore on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Defer focus until the panel is in the DOM.
    const id = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  // Simple focus trap inside the panel.
  function onTrapKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={requestClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(39,37,31,0.20)" }}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        onKeyDown={onTrapKeyDown}
        className="fixed top-0 right-0 bottom-0 z-50 bg-white flex flex-col"
        style={{
          width,
          borderLeft: "1px solid var(--color-warm-gray-light)",
          boxShadow: "-16px 0 40px rgba(39,37,31,0.10)",
        }}
      >
        <header
          className="flex items-start justify-between gap-3"
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--color-warm-gray-light)",
          }}
        >
          <div className="min-w-0">
            <div
              className="font-semibold text-near-black"
              style={{ fontSize: 18, letterSpacing: "-0.005em" }}
            >
              {title}
            </div>
            {subtitle && (
              <div className="text-warm-gray-med" style={{ fontSize: 12, marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="bg-transparent border-0 cursor-pointer text-warm-gray-med hover:text-near-black hover:bg-warm-gray-light rounded focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-blue"
            style={{ width: 28, height: 28, fontSize: 18, lineHeight: "20px" }}
          >
            ×
          </button>
        </header>
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: "24px 24px 32px" }}
        >
          {children}
        </div>
        {footer && (
          <footer
            className="flex items-center justify-between gap-3"
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--color-warm-gray-light)",
              background: "#FBFBFA",
            }}
          >
            {footer}
          </footer>
        )}
      </aside>

      <ConfirmModal
        open={confirmOpen}
        title="Discard changes?"
        body="Your edits to this record will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onClose();
        }}
      />
    </>
  );
}
