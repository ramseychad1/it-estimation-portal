import { useId, type ReactNode } from "react";

interface FormFieldProps {
  label?: ReactNode;
  required?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  /**
   * The form control. Receives `id` and `aria-describedby` (for helper/error)
   * via render-prop so the caller can wire them onto the actual input.
   */
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
  className?: string;
  /**
   * Pre-existing id, e.g. when the parent already manages id stability.
   * Defaults to a generated id.
   */
  id?: string;
}

/**
 * Wrapper for a single form control. Owns the label, the required-asterisk,
 * the helper text, and the error text — and wires the `htmlFor` /
 * `aria-describedby` / `aria-invalid` plumbing automatically.
 *
 * Used by <TextInput> and <Textarea>; can be used directly for any custom
 * control (Toggle, Select, etc.).
 */
export function FormField({
  label,
  required,
  helper,
  error,
  children,
  className = "",
  id: providedId,
}: FormFieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : helper ? helperId : undefined;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-small font-medium text-near-black">
          {label}
          {required && (
            <span aria-label="required" className="text-cardinal-red ml-0.5">
              *
            </span>
          )}
        </label>
      )}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p id={errorId} className="text-small text-cardinal-red" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="text-small text-warm-gray-med">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
