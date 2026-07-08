/**
 * Read-only rendering of a typed answer (UX-2). Yes/No and select answers
 * render as an accent chip so reviewers can scan them at a glance; numbers
 * get tabular numerals; free text keeps its pre-wrap paragraph treatment.
 */
interface AnswerValueProps {
  questionType: "LONG_TEXT" | "SHORT_TEXT" | "YES_NO" | "SINGLE_SELECT" | "NUMBER";
  answerText: string;
  /** Shown italic + muted when there is no answer. */
  emptyLabel?: string;
  fontSize?: number;
}

export function AnswerValue({
  questionType,
  answerText,
  emptyLabel = "Not answered",
  fontSize = 14,
}: AnswerValueProps) {
  if (!answerText) {
    return (
      <p
        className="m-0 mt-1"
        style={{ fontSize, color: "var(--color-warm-gray-med)", fontStyle: "italic" }}
      >
        {emptyLabel}
      </p>
    );
  }

  if (questionType === "YES_NO" || questionType === "SINGLE_SELECT") {
    return (
      <p className="m-0 mt-1">
        <span
          className="inline-flex items-center font-medium rounded-md"
          style={{
            padding: "2px 10px",
            fontSize: fontSize - 1,
            background: "var(--color-accent-soft)",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent-border)",
          }}
        >
          {answerText}
        </span>
      </p>
    );
  }

  if (questionType === "NUMBER") {
    return (
      <p
        className="m-0 mt-1 tabular-nums"
        style={{ fontSize, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}
      >
        {answerText}
      </p>
    );
  }

  return (
    <p
      className="m-0 mt-1"
      style={{ fontSize, color: "var(--fg-1)", whiteSpace: "pre-wrap" }}
    >
      {answerText}
    </p>
  );
}
