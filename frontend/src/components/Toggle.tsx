import { forwardRef, type ButtonHTMLAttributes } from "react";

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
}

/**
 * Accessible switch (role=switch). Visual matches the App Shell design —
 * 32x18 track, 14px knob, near-black when on.
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onCheckedChange, label, className = "", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={`inline-flex items-center gap-2.5 cursor-pointer border-0 bg-transparent ${className}`}
      style={{ font: "inherit" }}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          width: 32,
          height: 18,
          borderRadius: 999,
          background: checked ? "var(--color-near-black)" : "#C9C7C2",
          position: "relative",
          transition: "background 120ms cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 16 : 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            transition: "left 120ms cubic-bezier(0.2,0.8,0.2,1)",
          }}
        />
      </span>
      {label && <span className="text-body text-near-black">{label}</span>}
    </button>
  );
});
