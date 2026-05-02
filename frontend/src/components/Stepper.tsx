import { Check } from "lucide-react";

interface StepperProps {
  steps: string[];
  /** Zero-indexed; steps with index < currentStep render as completed. */
  currentStep: number;
}

/**
 * Horizontal multi-step indicator. Three states per step:
 *
 *   - completed (index < currentStep): Near-Black filled circle with check
 *   - current (index === currentStep):  Cardinal Red filled circle with number
 *   - future (index > currentStep):     Warm Gray border, Warm Gray Med number
 *
 * Cardinal Red on the current step is one of the few approved uses on
 * non-error UI — it's the "you are here" signal in a flow that the user
 * can't lose track of mid-multi-step. {@code docs/COLOR_USAGE.md} carves
 * out wayfinding accents from the danger-only rule explicitly.
 *
 * Purely visual — clicking does NOT navigate. The owning page drives step
 * state via the URL (?step=N) so back/forward and deep-links work.
 */
export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <ol
      className="flex items-center m-0 p-0 list-none"
      style={{ gap: 0 }}
      data-testid="stepper"
    >
      {steps.map((label, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;
        const isLast = idx === steps.length - 1;
        return (
          <li
            key={label}
            className="flex items-center"
            // grow each step + connector pair so the row spans the full
            // header width regardless of label length.
            style={{ flex: isLast ? "0 0 auto" : "1 1 0" }}
          >
            <span className="flex items-center" style={{ gap: 10 }}>
              <Circle state={isCompleted ? "completed" : isCurrent ? "current" : "future"} index={idx + 1} />
              <span
                className={
                  isCurrent ? "text-near-black font-semibold" : "text-warm-gray-med"
                }
                style={{ fontSize: 13 }}
                aria-current={isCurrent ? "step" : undefined}
              >
                {label}
              </span>
            </span>
            {!isLast && (
              <span
                aria-hidden="true"
                className="flex-1"
                style={{
                  height: 1,
                  background: isCompleted
                    ? "var(--color-near-black)"
                    : "var(--color-warm-gray-light)",
                  margin: "0 12px",
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Circle({
  state,
  index,
}: {
  state: "completed" | "current" | "future";
  index: number;
}) {
  // Border declared as longhand pieces (width/style/color) rather than
  // the `border:` shorthand. The future-state branch overrides only
  // `borderColor:`; mixing shorthand with longhand triggered a React
  // warning about non-deterministic application order in CSSOM.
  const base: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: "50%",
    fontSize: 12,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
  };
  if (state === "completed") {
    return (
      <span
        style={{
          ...base,
          background: "var(--color-near-black)",
          color: "var(--color-white)",
        }}
        aria-label={`Step ${index} completed`}
      >
        <Check className="w-3.5 h-3.5" strokeWidth={2} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        style={{
          ...base,
          background: "var(--color-cardinal-red)",
          color: "var(--color-white)",
        }}
      >
        {index}
      </span>
    );
  }
  return (
    <span
      style={{
        ...base,
        background: "transparent",
        color: "var(--color-warm-gray-med)",
        borderColor: "var(--color-border-strong)",
      }}
    >
      {index}
    </span>
  );
}
