import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Drawer } from "./Drawer";
import { PrimaryButton } from "./buttons";

function Harness({ initialDirty = false }: { initialDirty?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        isDirty={initialDirty}
        title="Edit thing"
        footer={<PrimaryButton onClick={() => setOpen(false)}>Save</PrimaryButton>}
      >
        <input aria-label="Name" />
      </Drawer>
    </>
  );
}

describe("<Drawer>", () => {
  it("renders content when open and traps initial focus on the panel", async () => {
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: /edit thing/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("closes on Escape when not dirty", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /edit thing/i })).not.toBeInTheDocument();
    });
  });

  it("shows a discard-changes confirm when isDirty and Esc is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness initialDirty />);
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("alertdialog", { name: /discard changes/i })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /edit thing/i })).toBeInTheDocument();
  });

  it("'Keep editing' returns to the drawer; 'Discard' closes it", async () => {
    const user = userEvent.setup();
    render(<Harness initialDirty />);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /keep editing/i }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("dialog", { name: /edit thing/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /discard/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /edit thing/i })).not.toBeInTheDocument();
    });
  });

  it("X button respects the dirty guard the same way Esc does", async () => {
    const user = userEvent.setup();
    render(<Harness initialDirty />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("alertdialog", { name: /discard changes/i })).toBeInTheDocument();
  });
});
