import { Info } from "lucide-react";
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { PrimaryButton } from "./buttons";

interface InfoModalProps {
  open: boolean;
  title: ReactNode;
  body: ReactNode;
  /**
   * Optional secondary link rendered below the body — e.g., "View
   * affected templates →". Pass {@code null} to omit. The link is
   * rendered as a tertiary link, not a button, because the primary
   * action is dismissal.
   */
  secondaryLink?: { label: string; onClick: () => void } | null;
  /** Defaults to "Got it". */
  closeLabel?: string;
  onClose: () => void;
  width?: number;
}

/**
 * Non-destructive information dialog. Visually distinct from
 * {@code ConfirmModal}: Light-Blue tint header bar + info icon, single
 * "Got it" button, no Cancel — there's nothing to confirm or cancel,
 * just acknowledge.
 *
 * <p>Used today by the SDLC phase activation guard ("Cannot activate
 * phase — N templates would be affected"). Other fits: read-only
 * blocking errors, informational notices, "we noticed something"
 * messages where the user just needs to dismiss.
 *
 * <p>Esc closes. Scrim click closes. The Got-it button gets focus on
 * open, so Enter dismisses too.
 */
export function InfoModal({
  open,
  title,
  body,
  secondaryLink,
  closeLabel = "Got it",
  onClose,
  width = 480,
}: InfoModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Defer focus to the close button so Enter dismisses immediately.
    setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  function onTrapKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(39,37,31,0.40)" }}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          tabIndex={-1}
          onKeyDown={onTrapKeyDown}
          className="bg-white rounded-lg overflow-hidden flex flex-col pointer-events-auto"
          style={{ width, boxShadow: "var(--shadow-modal)" }}
        >
          <header
            className="flex items-start gap-3"
            style={{
              padding: "16px 24px",
              background: "var(--color-light-blue-soft)",
              borderBottom: "1px solid rgba(187,221,230,0.7)",
            }}
          >
            <Info
              className="text-near-black mt-0.5 flex-shrink-0"
              style={{ width: 18, height: 18 }}
              strokeWidth={1.5}
            />
            <div
              className="font-semibold text-near-black"
              style={{ fontSize: 16, letterSpacing: "-0.005em" }}
            >
              {title}
            </div>
          </header>

          <div
            className="text-near-black"
            style={{ padding: "16px 24px", fontSize: 14, lineHeight: "20px" }}
          >
            {body}
            {secondaryLink && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={secondaryLink.onClick}
                  className="text-near-black bg-transparent border-0 p-0 cursor-pointer hover:underline"
                  style={{ fontSize: 13 }}
                >
                  {secondaryLink.label}
                </button>
              </div>
            )}
          </div>

          <footer
            className="flex items-center justify-end gap-2"
            style={{
              padding: "12px 24px 16px",
              borderTop: "1px solid var(--color-warm-gray-light)",
            }}
          >
            <PrimaryButton ref={closeButtonRef} onClick={onClose}>
              {closeLabel}
            </PrimaryButton>
          </footer>
        </div>
      </div>
    </>
  );
}
