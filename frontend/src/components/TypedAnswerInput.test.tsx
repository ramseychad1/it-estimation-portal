import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TypedAnswerInput, type TypedQuestionShape } from "./TypedAnswerInput";

function q(overrides: Partial<TypedQuestionShape>): TypedQuestionShape {
  return {
    questionText: "Test question?",
    questionType: "LONG_TEXT",
    options: [],
    ...overrides,
  };
}

describe("<TypedAnswerInput>", () => {
  it("renders Yes/No chips and reports the clicked value", async () => {
    const onChange = vi.fn();
    render(
      <TypedAnswerInput
        q={q({ questionType: "YES_NO" })}
        inputId="a1"
        value=""
        onChange={onChange}
      />,
    );

    const yes = screen.getByRole("radio", { name: "Yes" });
    expect(screen.getByRole("radio", { name: "No" })).toBeInTheDocument();
    await userEvent.click(yes);
    expect(onChange).toHaveBeenCalledWith("Yes");
  });

  it("clicking the selected chip clears the answer", async () => {
    const onChange = vi.fn();
    render(
      <TypedAnswerInput
        q={q({ questionType: "YES_NO" })}
        inputId="a1"
        value="Yes"
        onChange={onChange}
      />,
    );

    const yes = screen.getByRole("radio", { name: "Yes" });
    expect(yes).toHaveAttribute("aria-checked", "true");
    await userEvent.click(yes);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders few select options as chips, many as a native select", () => {
    const few = q({ questionType: "SINGLE_SELECT", options: ["Pilot", "Full rollout"] });
    const { rerender } = render(
      <TypedAnswerInput q={few} inputId="a1" value="" onChange={() => {}} />,
    );
    expect(screen.getByRole("radio", { name: "Pilot" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    const many = q({
      questionType: "SINGLE_SELECT",
      options: ["A", "B", "C", "D", "E", "F"],
    });
    rerender(<TypedAnswerInput q={many} inputId="a1" value="" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders a number input for NUMBER questions", () => {
    render(
      <TypedAnswerInput
        q={q({ questionType: "NUMBER" })}
        inputId="a1"
        value="12"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("spinbutton", { name: "Answer to: Test question?" })).toHaveValue(12);
  });

  it("renders a textarea for LONG_TEXT questions and surfaces errors", () => {
    render(
      <TypedAnswerInput
        q={q({ questionType: "LONG_TEXT" })}
        inputId="a1"
        value="hello"
        onChange={() => {}}
        error="Bad answer"
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("hello");
    expect(screen.getByText("Bad answer")).toBeInTheDocument();
  });
});
