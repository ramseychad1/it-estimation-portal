import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "./LoginPage";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

function setup() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<div>dashboard</div>} />
    </Routes>,
    { initialEntries: ["/login"] },
  );
}

describe("<LoginPage>", () => {
  it("submits credentials and redirects to /dashboard on success", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/auth/me") return Promise.resolve(new Response("", { status: 401 }));
      if (url === "/api/auth/login" && init?.method === "POST") {
        return Promise.resolve(
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
      }
      return Promise.resolve(new Response("", { status: 404 }));
    });

    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/email/i), "admin@local");
    await user.type(screen.getByLabelText(/password/i), "ChangeMe123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("dashboard")).toBeInTheDocument();
    });
  });

  it("shows an inline error on 401", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/auth/me") return Promise.resolve(new Response("", { status: 401 }));
      if (url === "/api/auth/login" && init?.method === "POST") {
        return Promise.resolve(new Response("", { status: 401 }));
      }
      return Promise.resolve(new Response("", { status: 404 }));
    });

    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/email/i), "admin@local");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });
});
