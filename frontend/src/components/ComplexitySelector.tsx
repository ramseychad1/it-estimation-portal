import type { Complexity } from "../lib/api/estimates";

interface ComplexitySelectorProps {
  value: Complexity | null;
  onChange: (next: Complexity | null) => void;
  disabled?: boolean;
}

interface ComplexityOption {
  value: Complexity;
  label: string;
  example: string;
}

const OPTIONS: ComplexityOption[] = [
  {
    value: "LOW",
    label: "Low",
    example:
      "Straightforward integration with one existing system. Few unknowns; the team can run with the answers as given.",
  },
  {
    value: "MED",
    label: "Medium",
    example:
      "Some unknowns or coordination across teams. Most pieces exist; a few need design work or new wiring.",
  },
  {
    value: "HIGH",
    label: "High",
    example:
      "Significant new work or many unknowns. Discovery may be needed; expect iteration on the answers as the team digs in.",
  },
];

/**
 * Three large clickable cards for the reviewer's complexity pick. The
 * selected card highlights with an accent border + soft accent tint
 * background; clicking the selected card again deselects (returns null).
 *
 * Phase 6b uses this on the review screen between the questions section
 * and the snapshot grid. The picked complexity drives which column in
 * the grid becomes editable.
 */
export function ComplexitySelector({
  value,
  onChange,
  disabled,
}: ComplexitySelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Complexity"
      className="grid"
      style={{
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
      }}
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(selected ? null : opt.value)}
            className="text-left bg-transparent cursor-pointer"
            style={{
              padding: "14px 16px",
              borderRadius: 6,
              border: selected
                ? "1px solid var(--color-accent)"
                : "1px solid var(--color-border-strong)",
              background: selected ? "var(--color-accent-soft)" : "var(--color-white)",
              boxShadow: selected ? "0 0 0 1px var(--color-accent)" : undefined,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <div
              className="font-semibold text-near-black"
              style={{ fontSize: 16, marginBottom: 6 }}
            >
              {opt.label}
            </div>
            <p
              className="m-0 text-warm-gray-med"
              style={{ fontSize: 13, lineHeight: 1.45 }}
            >
              {opt.example}
            </p>
          </button>
        );
      })}
    </div>
  );
}
