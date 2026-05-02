import { useId } from "react";
import { Textarea } from "./inputs";
import { relativeTime } from "../lib/relativeTime";

interface JustificationFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** Renders "Saving…" indicator. */
  isAutosaving?: boolean;
  /** ISO timestamp of the last successful save. Renders "Saved {relative time}". */
  savedAt?: string | null;
  disabled?: boolean;
  /** Visible above the textarea. Defaults to a sensible reviewer-screen helper. */
  helper?: string;
  maxLength?: number;
}

const DEFAULT_MAX = 4000;

/**
 * Multi-line textarea + character count + autosave indicator. Used on
 * the review screen for the SO's justification, which is required to
 * approve or reject. The footer reads "{N}/4000 characters" on the left
 * and "Saving…" or "Saved {relative time}" on the right.
 */
export function JustificationField({
  value,
  onChange,
  isAutosaving,
  savedAt,
  disabled,
  helper,
  maxLength = DEFAULT_MAX,
}: JustificationFieldProps) {
  const id = useId();
  const remaining = maxLength - value.length;
  const overLimit = remaining < 0;

  return (
    <div className="flex flex-col">
      {helper && (
        <p
          className="m-0 mb-2 text-warm-gray-med"
          style={{ fontSize: 12 }}
        >
          {helper}
        </p>
      )}
      <Textarea
        id={id}
        label={
          <span>
            Justification <span className="text-cardinal-red">*</span>
          </span>
        }
        rows={5}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={disabled}
        maxLength={maxLength}
        aria-label="Justification"
      />
      <div
        className="flex items-center justify-between mt-1"
        style={{ fontSize: 11, color: "var(--color-warm-gray-med)" }}
      >
        <span
          style={{
            color: overLimit ? "var(--color-cardinal-red)" : undefined,
          }}
        >
          {value.length}/{maxLength} characters
        </span>
        <span aria-live="polite">
          {isAutosaving ? (
            "Saving…"
          ) : savedAt ? (
            `Saved ${relativeTime(savedAt)}`
          ) : (
            ""
          )}
        </span>
      </div>
    </div>
  );
}
