/**
 * A single before/after value chip: gray for "before", light-blue tint for
 * "after", empty values render as an italic em-dash. The standard diff-row
 * building block in this codebase — originally the change-log entry's
 * before/after display, extracted here so other diff/review UIs (e.g. the
 * catalog import preview) render changes identically rather than inventing
 * a new visual language for "this value changed."
 */
export function ValueBlock({
  value,
  variant,
}: {
  value: string | null;
  variant: "before" | "after";
}) {
  const isBefore = variant === "before";
  const empty = value == null || value === "";
  return (
    <span
      className="inline-block flex-1 text-near-black"
      style={{
        padding: "6px 8px",
        background: isBefore ? "var(--color-warm-gray-light)" : "rgba(187, 221, 230, 0.30)",
        borderLeft: `2px solid ${
          isBefore ? "var(--color-warm-gray-med)" : "var(--color-light-blue)"
        }`,
        fontSize: 12,
        fontStyle: empty ? "italic" : "normal",
        color: empty ? "var(--color-warm-gray-med)" : "var(--color-near-black)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {empty ? "—" : value}
    </span>
  );
}
