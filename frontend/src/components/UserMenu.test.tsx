import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { UserMenu } from "./UserMenu";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function meAs(roles: string[]) {
  return new Response(
    JSON.stringify({
      id: 1,
      email: "user@local",
      firstName: "Local",
      lastName: "User",
      roles,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

beforeEach(() => fetchMock.mockReset());
afterEach(() => fetchMock.mockReset());

describe("<UserMenu>", () => {
  it("renders multi-role users with the plural 'Roles:' prefix and canonical order", async () => {
    // Pass roles out of canonical order to verify the menu sorts them
    // (Solution Owner should render after Admin, never before).
    fetchMock.mockResolvedValue(meAs(["Solution Owner", "Admin"]));
    renderWithProviders(<UserMenu onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText(/Roles:\s*Admin,\s*Solution Owner/)).toBeInTheDocument(),
    );
  });

  it("renders single-role users with the singular 'Role:' prefix", async () => {
    fetchMock.mockResolvedValue(meAs(["Requester"]));
    renderWithProviders(<UserMenu onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText(/Role:\s*Requester/)).toBeInTheDocument(),
    );
  });

  it("does NOT render a 'Switch role' affordance", async () => {
    fetchMock.mockResolvedValue(meAs(["Admin", "Requester"]));
    renderWithProviders(<UserMenu onClose={() => {}} />);

    // Wait for the menu to actually mount (auth /me has to resolve first).
    await screen.findByText(/Roles:\s*Admin,\s*Requester/);
    expect(screen.queryByText(/switch role/i)).not.toBeInTheDocument();
  });
});
