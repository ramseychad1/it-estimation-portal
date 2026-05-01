import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { DestructiveButton, PrimaryButton, SecondaryButton } from "./buttons";

interface ConfirmModalProps {
  open: boolean;
  title: ReactNode;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button as Cardinal Red (Destructive variant). */
  destructive?: boolean;
  /**
   * High-stakes confirm: if set, render a checkbox the user must tick before
   * the confirm button enables. Pass the label string for the checkbox.
   */
  requireCheckboxLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  width?: number;
}

/**
 * Centered confirmation modal. Focus-traps until the user picks Confirm or
 * Cancel — Esc fires Cancel. Use {@code destructive} for delete dialogs.
 */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  requireCheckboxLabel,
  onCancel,
  onConfirm,
  width = 480,
}: ConfirmModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset checkbox each time the modal re-opens.
  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

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

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const confirmDisabled = busy || (!!requireCheckboxLabel && !acknowledged);

  const ConfirmBtn = destructive ? DestructiveButton : PrimaryButton;

  return (
    <>
      {/* Scrim is a SIBLING of the panel, not an ancestor — aria-hidden on
          a wrapper would also hide the panel from the accessibility tree. */}
      <div
        onClick={onCancel}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(39,37,31,0.40)" }}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          tabIndex={-1}
          onKeyDown={onTrapKeyDown}
          className="bg-white rounded-lg overflow-hidden flex flex-col pointer-events-auto"
          style={{ width, boxShadow: "var(--shadow-modal)" }}
        >
          <header style={{ padding: "20px 24px 12px" }}>
            <div
              className="font-semibold text-near-black"
              style={{ fontSize: 18, letterSpacing: "-0.005em" }}
            >
              {title}
            </div>
          </header>
          <div
            className="text-near-black"
            style={{ padding: "0 24px 20px", fontSize: 14, lineHeight: "20px" }}
          >
            {body}
            {requireCheckboxLabel && (
              <label
                className="flex items-center gap-2 mt-4 text-near-black cursor-pointer"
                style={{ fontSize: 13 }}
              >
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  style={{ accentColor: "var(--color-near-black)" }}
                />
                {requireCheckboxLabel}
              </label>
            )}
          </div>
          <footer
            className="flex items-center justify-end gap-2"
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--color-warm-gray-light)",
              background: "#FBFBFA",
            }}
          >
            <SecondaryButton onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </SecondaryButton>
            <ConfirmBtn onClick={handleConfirm} disabled={confirmDisabled}>
              {busy ? "Working…" : confirmLabel}
            </ConfirmBtn>
          </footer>
        </div>
      </div>
    </>
  );
}
