import { describe, expect, it } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";

function Trigger({ message }: { message: string }) {
  const toast = useToast();
  return (
    <button onClick={() => toast.success(message, 0)}>fire</button>
  );
}

function ErrorTrigger() {
  const toast = useToast();
  return (
    <button onClick={() => toast.error("kaboom", 0)}>err</button>
  );
}

describe("<ToastProvider> + useToast", () => {
  it("renders a success toast inside an aria-live region", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger message="Saved." />
      </ToastProvider>,
    );
    await user.click(screen.getByText("fire"));
    const liveRegion = await waitFor(() =>
      document.querySelector('[aria-live="polite"]') as HTMLElement,
    );
    expect(liveRegion).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  it("renders an error toast with role=alert", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ErrorTrigger />
      </ToastProvider>,
    );
    await user.click(screen.getByText("err"));
    expect(await screen.findByRole("alert")).toHaveTextContent("kaboom");
  });

  it("dismisses on click", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger message="Bye." />
      </ToastProvider>,
    );
    await user.click(screen.getByText("fire"));
    const dismiss = await screen.findByRole("button", { name: "Dismiss" });
    await act(async () => {
      await user.click(dismiss);
    });
    await waitFor(() => {
      expect(screen.queryByText("Bye.")).not.toBeInTheDocument();
    });
  });
});
