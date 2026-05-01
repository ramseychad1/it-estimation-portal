/**
 * TEST CONVENTION FOR THE HOURS GRID:
 *
 * HoursCell selects-all on focus (spreadsheet convention), and userEvent
 * v14's `keyboard()` doesn't always honour text selections cleanly across
 * a focus → type sequence — sometimes typing appends after the
 * selection rather than replacing it, depending on JSDOM's selection
 * implementation that day. Tests for the grid (this file plus the
 * detail-page tests) use the unambiguous pattern:
 *
 *   await user.click(cell);
 *   await user.clear(cell);
 *   await user.type(cell, "42");
 *
 * `clear` blanks the field deterministically, then `type` produces the
 * intended characters one by one. Stick to this pattern when adding new
 * tests against any cell that uses select-on-focus. `user.keyboard()` is
 * fine for keys that don't depend on the input's selection state
 * (Enter, arrow keys, Escape).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HoursCell } from "./HoursCell";

function setup(overrides: Partial<Parameters<typeof HoursCell>[0]> = {}) {
  const onCommit = vi.fn();
  const onMove = vi.fn();
  render(
    <HoursCell
      value={0}
      onCommit={onCommit}
      ariaLabel="Discovery Onshore L"
      onMove={onMove}
      {...overrides}
    />,
  );
  const input = screen.getByLabelText("Discovery Onshore L") as HTMLInputElement;
  return { input, onCommit, onMove };
}

describe("<HoursCell>", () => {
  it("strips non-numeric input as the user types", async () => {
    const { input } = setup();
    const user = userEvent.setup();
    await user.click(input);
    await user.keyboard("ab12cd34");
    expect(input.value).toBe("1234");
  });

  it("commits the typed value on blur", async () => {
    const { input, onCommit } = setup();
    const user = userEvent.setup();
    await user.click(input);
    // The component selects all on focus, so any keystrokes replace.
    await user.keyboard("42");
    input.blur();
    expect(onCommit).toHaveBeenCalledWith(42);
  });

  it("treats blank input as 0 on commit", async () => {
    const { input, onCommit } = setup({ value: 5 });
    const user = userEvent.setup();
    await user.click(input);
    await user.keyboard("{Backspace}{Backspace}");
    input.blur();
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it("Enter commits and moves down to the same column", async () => {
    const { input, onMove, onCommit } = setup();
    const user = userEvent.setup();
    await user.click(input);
    await user.keyboard("7{Enter}");
    expect(onCommit).toHaveBeenCalledWith(7);
    expect(onMove).toHaveBeenCalledWith("down");
  });

  it("flags negative values with an alert (Cardinal Red border)", async () => {
    const { input } = setup();
    const user = userEvent.setup();
    await user.click(input);
    await user.keyboard("-3");
    // aria-invalid is set when the value parses < 0; no assertion-friendly
    // way to read border colour cheaply, so we use the aria signal.
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("renders an aria-described error message when error prop is set", () => {
    setup({ error: "Hours must be ≥ 0" });
    expect(screen.getByRole("alert")).toHaveTextContent("Hours must be ≥ 0");
  });
});
