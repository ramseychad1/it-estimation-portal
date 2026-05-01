import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import { AuthGuard } from "./AuthGuard";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<div>login page</div>} />
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <div>protected content</div>
          </AuthGuard>
        }
      />
    </Routes>,
    { initialEntries: [path] },
  );
}

describe("<AuthGuard>", () => {
  it("redirects unauthenticated users to /login", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));
    renderAt("/dashboard");
    await waitFor(() => {
      expect(screen.getByText("login page")).toBeInTheDocument();
    });
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "1",
          email: "admin@local",
          firstName: "Local",
          lastName: "Admin",
          roles: ["Admin"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderAt("/dashboard");
    await waitFor(() => {
      expect(screen.getByText("protected content")).toBeInTheDocument();
    });
  });
});
