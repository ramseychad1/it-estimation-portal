import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnswerValue } from "./AnswerValue";

describe("<AnswerValue>", () => {
  it("renders the empty label when there is no answer", () => {
    render(<AnswerValue questionType="LONG_TEXT" answerText="" emptyLabel="Not answered" />);
    expect(screen.getByText("Not answered")).toBeInTheDocument();
  });

  it("renders Yes/No answers as a chip", () => {
    render(<AnswerValue questionType="YES_NO" answerText="Yes" />);
    const chip = screen.getByText("Yes");
    expect(chip).toBeInTheDocument();
    // Chip styling comes from the accent tokens
    expect(chip).toHaveStyle({ background: "var(--color-accent-soft)" });
  });

  it("renders select answers as a chip and text answers as a paragraph", () => {
    const { rerender } = render(
      <AnswerValue questionType="SINGLE_SELECT" answerText="Pilot" />,
    );
    expect(screen.getByText("Pilot")).toHaveStyle({ background: "var(--color-accent-soft)" });

    rerender(<AnswerValue questionType="LONG_TEXT" answerText="Free text here" />);
    expect(screen.getByText("Free text here")).toHaveStyle({ whiteSpace: "pre-wrap" });
  });
});
