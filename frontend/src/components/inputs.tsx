import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { FormField } from "./FormField";

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
  const invalid = !!error;
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      helper={helper}
      error={error}
      className={containerClassName}
    >
      {(field) => (
        <input
          ref={ref}
          {...field}
          required={required}
          className={`${controlClasses} h-8 px-3 ${invalid ? "border-cardinal-red focus:border-cardinal-red" : ""} ${className}`}
          {...rest}
        />
      )}
    </FormField>
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
  const invalid = !!error;
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      helper={helper}
      error={error}
      className={containerClassName}
    >
      {(field) => (
        <textarea
          ref={ref}
          {...field}
          required={required}
          rows={rows}
          className={`${controlClasses} px-3 py-2 ${invalid ? "border-cardinal-red focus:border-cardinal-red" : ""} ${className}`}
          {...rest}
        />
      )}
    </FormField>
  );
});
