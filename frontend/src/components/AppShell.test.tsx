import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import { AppShell } from "./AppShell";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

function meAs(roles: string[]) {
  return new Response(
    JSON.stringify({
      id: "1",
      email: "user@local",
      firstName: "Local",
      lastName: "User",
      roles,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function renderShellAt(path: string, pageTitle: string) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/admin/teams"
        element={
          <AppShell>
            <h1>{pageTitle}</h1>
          </AppShell>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AppShell>
            <h1>{pageTitle}</h1>
          </AppShell>
        }
      />
    </Routes>,
    { initialEntries: [path] },
  );
}

describe("<AppShell>", () => {
  it("hides the Admin section for users without the Admin role", async () => {
    fetchMock.mockResolvedValue(meAs(["Estimator"]));
    renderShellAt("/dashboard", "Dashboard heading");
    await waitFor(() => {
      expect(screen.getByTestId("section-Workspace")).toBeInTheDocument();
    });
    expect(screen.getByTestId("section-Catalog")).toBeInTheDocument();
    expect(screen.queryByTestId("section-Admin")).not.toBeInTheDocument();
  });

  it("shows the Admin section for an admin user", async () => {
    fetchMock.mockResolvedValue(meAs(["Admin"]));
    renderShellAt("/dashboard", "Dashboard heading");
    await waitFor(() => {
      expect(screen.getByTestId("section-Admin")).toBeInTheDocument();
    });
  });

  it("marks the active nav item with the Cardinal Red left bar", async () => {
    fetchMock.mockResolvedValue(meAs(["Admin"]));
    renderShellAt("/admin/teams", "Teams heading");

    const teamsLink = await waitFor(() => screen.getByTestId("nav-Teams"));
    expect(teamsLink.className).toMatch(/is-active/);
    expect((teamsLink as HTMLElement).style.borderLeft).toContain("var(--color-cardinal-red)");

    const dashboardLink = screen.getByTestId("nav-Dashboard");
    expect(dashboardLink.className).not.toMatch(/is-active/);
    expect((dashboardLink as HTMLElement).style.borderLeft).toContain("transparent");
  });
});
