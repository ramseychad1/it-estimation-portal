import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export interface HoursCellHandle {
  focus(): void;
  /** Imperative blur — used by Esc handling at the row/grid level. */
  blur(): void;
}

interface HoursCellProps {
  value: number;
  onCommit: (next: number) => void;
  /** Greyed-out treatment when the phase has been deactivated. Cell
      remains editable so SOs can correct historically-included rows. */
  isInactivePhase?: boolean;
  /** When set, renders the Cardinal Red border + helper text below. */
  error?: string | null;
  ariaLabel: string;
  /** Move-to-next-cell handler for Enter (down) and arrow-at-edge keys. */
  onMove?: (dir: "up" | "down" | "left" | "right") => void;
  /** Multi-cell paste callback — see HoursGrid.handlePasteAt. */
  onPasteMulti?: (rows: (number | null)[][]) => void;
  disabled?: boolean;
}

/**
 * Single editable numeric cell. Numeric-only input (typing letters is
 * silently ignored). Empty input commits as {@code 0} on blur.
 *
 * Keyboard:
 *   Tab / Shift-Tab — browser-native (cell-by-cell across the row, then
 *                      down to the next row).
 *   Enter           — commit + onMove("down")
 *   Esc             — blur + revert to last committed value
 *   Arrow keys      — onMove(dir) when caret is at start/end or empty
 *
 * Paste: a multi-cell TSV paste fans out via {@link #onPasteMulti}; a
 * single-cell paste falls through to standard input behaviour.
 */
export const HoursCell = forwardRef<HoursCellHandle, HoursCellProps>(function HoursCell(
  { value, onCommit, isInactivePhase, error, ariaLabel, onMove, onPasteMulti, disabled },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Local string state so the user can type intermediate states like "0."
  // before committing. Sync with prop only when not focused.
  const [text, setText] = useState<string>(formatNumber(value));

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }), []);

  useEffect(() => {
    // Don't clobber what the user is typing. Sync only when blurred.
    if (document.activeElement !== inputRef.current) {
      setText(formatNumber(value));
    }
  }, [value]);

  function commit() {
    const n = Number(text);
    const next = Number.isFinite(n) && text.trim() !== "" ? n : 0;
    setText(formatNumber(next));
    if (next !== value) onCommit(next);
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      onMove?.("down");
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setText(formatNumber(value));
      inputRef.current?.blur();
      return;
    }
    if (onMove && (e.key === "ArrowUp" || e.key === "ArrowDown" ||
                   e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const input = inputRef.current!;
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      const atEnd = input.selectionStart === text.length && input.selectionEnd === text.length;
      const empty = text.length === 0;
      if (e.key === "ArrowUp" && (empty || atStart)) {
        e.preventDefault();
        commit();
        onMove("up");
      } else if (e.key === "ArrowDown" && (empty || atEnd)) {
        e.preventDefault();
        commit();
        onMove("down");
      } else if (e.key === "ArrowLeft" && (empty || atStart)) {
        e.preventDefault();
        commit();
        onMove("left");
      } else if (e.key === "ArrowRight" && (empty || atEnd)) {
        e.preventDefault();
        commit();
        onMove("right");
      }
    }
  }

  function handlePaste(e: ReactClipboardEvent<HTMLInputElement>) {
    if (!onPasteMulti) return;
    const raw = e.clipboardData.getData("text/plain");
    if (!raw || (!raw.includes("\t") && !raw.includes("\n"))) return; // single cell → default paste

    e.preventDefault();
    // Lazy import to keep the parser out of the critical render path.
    import("../../lib/parseTsv").then(({ parseTsv }) => {
      const rows = parseTsv(raw);
      if (rows.length > 0) onPasteMulti(rows);
    });
  }

  const numericInvalid = !Number.isFinite(Number(text)) || (text.trim() !== "" && Number(text) < 0);
  const showError = !!error || numericInvalid;

  return (
    <div className="flex flex-col" style={{ width: 84 }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={showError || undefined}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          // Numeric-only input: silently strip anything that's not 0-9 or "." or "-".
          // We allow the leading "-" to be typed but final commit clamps to >= 0
          // via the parent's validation; numericInvalid above flags it red.
          const sanitised = e.target.value.replace(/[^0-9.\-]/g, "");
          setText(sanitised);
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="w-full text-near-black tabular-nums focus:outline-none"
        style={{
          height: 28,
          padding: "0 8px",
          textAlign: "right",
          borderRadius: 4,
          border: showError
            ? "1px solid var(--color-cardinal-red)"
            : "1px solid var(--color-border-strong)",
          background: isInactivePhase ? "var(--color-warm-gray-light)" : "var(--color-white)",
          fontSize: 13,
          // 2px Light Blue ring on focus (per spec). Implemented via box-shadow
          // since we already have a 1px border holding the visual rectangle.
          boxShadow: undefined,
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-light-blue)";
          e.currentTarget.style.borderColor = "var(--color-light-blue)";
          e.currentTarget.select();
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.boxShadow = "";
          e.currentTarget.style.borderColor = showError
            ? "var(--color-cardinal-red)"
            : "var(--color-border-strong)";
        }}
      />
      {error && (
        <span
          role="alert"
          className="mt-0.5"
          style={{ fontSize: 11, color: "var(--color-cardinal-red)" }}
        >
          {error}
        </span>
      )}
    </div>
  );
});

function formatNumber(n: number): string {
  // Drop trailing zeros for cleaner editing; "10" not "10.00". The server
  // stores BigDecimal so precision is fine — display sticks with the
  // human-friendly form.
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}
