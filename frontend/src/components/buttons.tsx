import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type Variant = "primary" | "secondary" | "tertiary" | "destructive";

interface BaseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

const baseClasses =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md text-body font-medium " +
  "border transition-colors duration-hover ease-out-soft " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-blue";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-near-black text-white border-near-black hover:bg-near-black-hover hover:border-near-black-hover",
  secondary:
    "bg-white text-near-black border-border hover:bg-warm-gray-light",
  tertiary:
    "bg-transparent text-near-black border-transparent hover:bg-warm-gray-light",
  destructive:
    "bg-white text-cardinal-red border-cardinal-red hover:bg-cardinal-red hover:text-white",
};

function makeButton(variant: Variant) {
  const Comp = forwardRef<HTMLButtonElement, BaseProps>(function Button(
    { className = "", type = "button", children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  });
  Comp.displayName = `Button(${variant})`;
  return Comp;
}

export const PrimaryButton = makeButton("primary");
export const SecondaryButton = makeButton("secondary");
export const TertiaryButton = makeButton("tertiary");
export const DestructiveButton = makeButton("destructive");
