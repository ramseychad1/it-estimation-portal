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
  it("hides the Admin and Catalog sections for users without the matching roles", async () => {
    // Phase 7.5: Catalog section is now SO-gated, Admin stays Admin-gated.
    // An Estimator-only user sees neither (no SO, no Admin). Workspace is
    // visible because Dashboard has no per-item gate.
    fetchMock.mockResolvedValue(meAs(["Estimator"]));
    renderShellAt("/dashboard", "Dashboard heading");
    await waitFor(() => {
      expect(screen.getByTestId("section-Workspace")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("section-Catalog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-Admin")).not.toBeInTheDocument();
  });

  it("shows Catalog for Solution Owners (and Admins via implication)", async () => {
    fetchMock.mockResolvedValue(meAs(["Solution Owner"]));
    renderShellAt("/dashboard", "Dashboard heading");
    await waitFor(() => {
      expect(screen.getByTestId("section-Catalog")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("section-Admin")).not.toBeInTheDocument();
  });

  it("shows the Admin section AND every other gated surface for an Admin user", async () => {
    // Phase 7.5: Admin implies SOLUTION_OWNER + REQUESTER, so Catalog is
    // also visible even though admin@local has Admin only.
    fetchMock.mockResolvedValue(meAs(["Admin"]));
    renderShellAt("/dashboard", "Dashboard heading");
    await waitFor(() => {
      expect(screen.getByTestId("section-Admin")).toBeInTheDocument();
    });
    expect(screen.getByTestId("section-Catalog")).toBeInTheDocument();
    expect(screen.getByTestId("section-Workspace")).toBeInTheDocument();
  });

  it("marks the active nav item with the accent left bar", async () => {
    fetchMock.mockResolvedValue(meAs(["Admin"]));
    renderShellAt("/admin/teams", "Teams heading");

    const teamsLink = await waitFor(() => screen.getByTestId("nav-Teams"));
    expect(teamsLink.className).toMatch(/is-active/);
    expect((teamsLink as HTMLElement).style.borderLeft).toContain("var(--color-accent)");

    const dashboardLink = screen.getByTestId("nav-Dashboard");
    expect(dashboardLink.className).not.toMatch(/is-active/);
    expect((dashboardLink as HTMLElement).style.borderLeft).toContain("transparent");
  });
});
