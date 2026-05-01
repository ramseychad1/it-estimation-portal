import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "./FormField";

describe("<FormField>", () => {
  it("links the label to the input via htmlFor / id", () => {
    render(
      <FormField label="Name" required>
        {(field) => <input {...field} placeholder="hi" />}
      </FormField>,
    );
    const input = screen.getByPlaceholderText("hi") as HTMLInputElement;
    const label = screen.getByText("Name");
    expect(label.tagName).toBe("LABEL");
    expect((label as HTMLLabelElement).htmlFor).toBe(input.id);
  });

  it("marks the asterisk as 'required' for screen readers", () => {
    render(
      <FormField label="Email" required>
        {(field) => <input {...field} />}
      </FormField>,
    );
    expect(screen.getByLabelText("required")).toBeInTheDocument();
  });

  it("renders helper text when no error is set", () => {
    render(
      <FormField label="X" helper="Hint goes here">
        {(field) => <input {...field} />}
      </FormField>,
    );
    expect(screen.getByText("Hint goes here")).toBeInTheDocument();
  });

  it("renders error text and wires aria-invalid + aria-describedby", () => {
    render(
      <FormField label="Y" helper="ignored when error" error="Required">
        {(field) => <input {...field} data-testid="i" />}
      </FormField>,
    );
    const input = screen.getByTestId("i");
    const error = screen.getByRole("alert");

    expect(error).toHaveTextContent("Required");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    // Helper text should NOT render when error is set.
    expect(screen.queryByText("ignored when error")).not.toBeInTheDocument();
  });
});
