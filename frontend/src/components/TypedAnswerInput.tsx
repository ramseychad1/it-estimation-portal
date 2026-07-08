import { Textarea, TextInput } from "./inputs";

/**
 * Minimal question shape shared by the wizard (catalog QuestionListItem)
 * and the revision editor (EstimateRequestAnswerView) — both satisfy it
 * structurally.
 */
export interface TypedQuestionShape {
  questionText: string;
  questionType: "LONG_TEXT" | "SHORT_TEXT" | "YES_NO" | "SINGLE_SELECT" | "NUMBER";
  options: string[];
}

interface TypedAnswerInputProps {
  q: TypedQuestionShape;
  inputId: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Renders the control that matches the question's answer type (UX-2). All
 * types store their answer as a string ("Yes"/"No", the chosen option, a
 * decimal string) so the save payload shape is unchanged. Clicking the
 * selected chip again clears the answer (mirrors ComplexitySelector).
 */
export function TypedAnswerInput({ q, inputId, value, onChange, error }: TypedAnswerInputProps) {
  const chipOptions =
    q.questionType === "YES_NO"
      ? ["Yes", "No"]
      : q.questionType === "SINGLE_SELECT" && q.options.length <= 5
        ? q.options
        : null;

  if (chipOptions) {
    return (
      <div>
        <div role="radiogroup" aria-label={`Answer to: ${q.questionText}`} className="flex flex-wrap" style={{ gap: 8 }}>
          {chipOptions.map((opt) => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(selected ? "" : opt)}
                className="cursor-pointer rounded-md font-medium"
                style={{
                  padding: "7px 16px",
                  fontSize: 14,
                  border: selected
                    ? "1.5px solid var(--color-accent)"
                    : "1.5px solid var(--color-border-strong)",
                  background: selected ? "var(--color-accent-soft)" : "var(--color-white)",
                  color: selected ? "var(--color-accent)" : "var(--fg-1)",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {error && (
          <p className="m-0" role="alert" style={{ fontSize: 12, color: "var(--color-cardinal-red)", marginTop: 6 }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  if (q.questionType === "SINGLE_SELECT") {
    return (
      <div>
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          aria-label={`Answer to: ${q.questionText}`}
          className="h-8 px-2 rounded-md border border-border bg-white text-body focus:outline-none focus:border-warm-gray-med focus:ring-2 focus:ring-accent"
          style={{ maxWidth: 360, width: "100%" }}
        >
          <option value="">Select an option…</option>
          {q.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {error && (
          <p className="m-0" role="alert" style={{ fontSize: 12, color: "var(--color-cardinal-red)", marginTop: 6 }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  if (q.questionType === "NUMBER") {
    return (
      <TextInput
        id={inputId}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        aria-label={`Answer to: ${q.questionText}`}
        error={error}
        style={{ maxWidth: 200 }}
      />
    );
  }

  if (q.questionType === "SHORT_TEXT") {
    return (
      <TextInput
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        maxLength={500}
        aria-label={`Answer to: ${q.questionText}`}
        error={error}
      />
    );
  }

  return (
    <Textarea
      id={inputId}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      maxLength={8000}
      rows={3}
      aria-label={`Answer to: ${q.questionText}`}
      error={error}
    />
  );
}
