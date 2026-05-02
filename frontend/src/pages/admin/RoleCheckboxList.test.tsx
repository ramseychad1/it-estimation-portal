import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { RoleCheckboxList } from "./RoleCheckboxList";

/**
 * Wrapper that mirrors how Invite/Edit drawers wire the component:
 * they own selectedIds in local state and pass an onChange that
 * persists. Lets the test exercise the auto-check + lock behavior end
 * to end without having to plumb through the full drawer.
 */
function Harness({ initial = [] as number[], disabled = false }: { initial?: number[]; disabled?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<number[]>(initial);
  return (
    <div>
      <RoleCheckboxList
        selectedIds={selectedIds}
        onChange={setSelectedIds}
        disabled={disabled}
      />
      <output data-testid="selected">{selectedIds.join(",")}</output>
    </div>
  );
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("<RoleCheckboxList>", () => {
  it("initial render: only the roles in selectedIds are checked", () => {
    render(<Harness initial={[2, 4]} />);
    expect(screen.getByRole("checkbox", { name: "Admin" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("checkbox", { name: "Solution Owner" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Estimator" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("checkbox", { name: "Requester" })).toHaveAttribute("aria-checked", "true");
  });

  it("checking Admin auto-checks all other roles AND locks them", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initial={[]} />);

    await user.click(screen.getByRole("checkbox", { name: "Admin" }));

    // All four are now checked.
    expect(screen.getByRole("checkbox", { name: "Admin" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Solution Owner" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Estimator" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Requester" })).toHaveAttribute("aria-checked", "true");

    // The non-Admin checkboxes are locked (aria-disabled true).
    expect(screen.getByRole("checkbox", { name: "Solution Owner" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox", { name: "Estimator" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox", { name: "Requester" })).toHaveAttribute("aria-disabled", "true");

    // The Admin checkbox itself is NOT disabled — the user can always
    // unselect Admin.
    expect(screen.getByRole("checkbox", { name: "Admin" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("unchecking Admin restores the previous non-Admin selection", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initial={[2]} /> /* Solution Owner pre-selected */);

    // Toggle Admin on: SO + Estimator + Requester all auto-check.
    await user.click(screen.getByRole("checkbox", { name: "Admin" }));
    expect(screen.getByRole("checkbox", { name: "Estimator" })).toHaveAttribute("aria-checked", "true");

    // Toggle Admin off: only the original Solution Owner should remain.
    await user.click(screen.getByRole("checkbox", { name: "Admin" }));
    expect(screen.getByRole("checkbox", { name: "Admin" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("checkbox", { name: "Solution Owner" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Estimator" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("checkbox", { name: "Requester" })).toHaveAttribute("aria-checked", "false");
  });

  it("locked non-Admin checkboxes carry the implication tooltip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initial={[]} />);

    await user.click(screen.getByRole("checkbox", { name: "Admin" }));

    // The button itself carries the title attribute.
    expect(screen.getByRole("checkbox", { name: "Solution Owner" })).toHaveAttribute(
      "title",
      "Admin role includes all permissions.",
    );
  });

  it("disabled prop disables every checkbox including Admin", () => {
    render(<Harness initial={[1]} disabled />);
    expect(screen.getByRole("checkbox", { name: "Admin" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox", { name: "Solution Owner" })).toHaveAttribute("aria-disabled", "true");
  });
});
