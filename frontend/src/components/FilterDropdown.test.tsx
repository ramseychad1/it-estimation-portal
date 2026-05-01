import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterDropdown, type FilterOption } from "./FilterDropdown";

type Status = "ALL" | "ACTIVE" | "INACTIVE";
const SINGLE_OPTS: FilterOption<Status>[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

type Role = "Admin" | "Estimator" | "Solution Owner";
const MULTI_OPTS: FilterOption<Role>[] = [
  { value: "Admin", label: "Admin" },
  { value: "Estimator", label: "Estimator" },
  { value: "Solution Owner", label: "Solution Owner" },
];

describe("<FilterDropdown> single mode", () => {
  it("renders 'Status: {label}' for the active option", () => {
    render(
      <FilterDropdown<Status>
        mode="single"
        label="Status"
        value="ACTIVE"
        options={SINGLE_OPTS}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /status: active/i })).toBeInTheDocument();
  });

  it("selecting an option fires onChange and closes the menu", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterDropdown<Status>
        mode="single"
        label="Status"
        value="ALL"
        options={SINGLE_OPTS}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /status: all/i }));
    await user.click(screen.getByRole("option", { name: "Inactive" }));
    expect(onChange).toHaveBeenCalledWith("INACTIVE");
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });
});

describe("<FilterDropdown> multi mode", () => {
  it("renders 'Roles: All' when value is empty", () => {
    render(
      <FilterDropdown<Role>
        mode="multi"
        label="Roles"
        value={[]}
        options={MULTI_OPTS}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /roles: all/i })).toBeInTheDocument();
  });

  it("renders 'Roles: {only}' when one item is selected (no chips)", () => {
    render(
      <FilterDropdown<Role>
        mode="multi"
        label="Roles"
        value={["Admin"]}
        options={MULTI_OPTS}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /roles: admin/i })).toBeInTheDocument();
    expect(screen.queryByTestId("chip-Admin")).not.toBeInTheDocument();
  });

  it("renders count + chips for two selections", () => {
    render(
      <FilterDropdown<Role>
        mode="multi"
        label="Roles"
        value={["Admin", "Estimator"]}
        options={MULTI_OPTS}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /roles: 2 selected/i })).toBeInTheDocument();
    expect(screen.getByTestId("chip-Admin")).toBeInTheDocument();
    expect(screen.getByTestId("chip-Estimator")).toBeInTheDocument();
  });

  it("toggles an option without closing the menu", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterDropdown<Role>
        mode="multi"
        label="Roles"
        value={["Admin"]}
        options={MULTI_OPTS}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /roles: admin/i }));
    await user.click(screen.getByRole("option", { name: /estimator/i }));
    expect(onChange).toHaveBeenLastCalledWith(["Admin", "Estimator"]);
    // Menu should stay open in multi mode.
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("chip × removes a single item", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterDropdown<Role>
        mode="multi"
        label="Roles"
        value={["Admin", "Estimator"]}
        options={MULTI_OPTS}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /remove admin/i }));
    expect(onChange).toHaveBeenLastCalledWith(["Estimator"]);
  });

  it("'Clear all' empties the array and is hidden when nothing selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <FilterDropdown<Role>
        mode="multi"
        label="Roles"
        value={["Admin"]}
        options={MULTI_OPTS}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /roles: admin/i }));
    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);

    rerender(
      <FilterDropdown<Role>
        mode="multi"
        label="Roles"
        value={[]}
        options={MULTI_OPTS}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /roles: all/i }));
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });
});
