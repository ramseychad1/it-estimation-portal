import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

interface FieldShellProps {
  id: string;
  label?: ReactNode;
  required?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, required, helper, error, children, className = "" }: FieldShellProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-small font-medium text-near-black">
          {label}
          {required && (
            <span aria-hidden="true" className="text-cardinal-red ml-0.5">*</span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-small text-cardinal-red" role="alert">{error}</p>
      ) : helper ? (
        <p className="text-small text-warm-gray-med">{helper}</p>
      ) : null}
    </div>
  );
}

const controlClasses =
  "w-full rounded-md border border-border bg-white text-body text-near-black " +
  "placeholder:text-warm-gray-med " +
  "transition-colors duration-hover ease-out-soft " +
  "focus:outline-none focus:border-warm-gray-med focus:ring-2 focus:ring-light-blue " +
  "disabled:bg-warm-gray-light disabled:text-warm-gray-med";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { id, label, helper, error, required, containerClassName, className = "", ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const invalid = !!error;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      helper={helper}
      error={error}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={invalid || undefined}
        className={`${controlClasses} h-8 px-3 ${invalid ? "border-cardinal-red focus:border-cardinal-red" : ""} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, helper, error, required, containerClassName, className = "", rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const invalid = !!error;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      helper={helper}
      error={error}
      className={containerClassName}
    >
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={`${controlClasses} px-3 py-2 ${invalid ? "border-cardinal-red focus:border-cardinal-red" : ""} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
});
