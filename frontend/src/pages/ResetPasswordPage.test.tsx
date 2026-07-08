import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordPage } from "./ResetPasswordPage";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID = { valid: true, email: "user@example.com", expiresAt: "2030-01-01T00:00:00Z" };

type FetchState = {
  tokenResponse: unknown;
  tokenStatus: number;
  completeStatus: number;
  completeBody: unknown;
  completeCalls: { path: string; body: string }[];
};

let state: FetchState;

function installRouter() {
  state = {
    tokenResponse: VALID,
    tokenStatus: 200,
    completeStatus: 204,
    completeBody: null,
    completeCalls: [],
  };

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === "/api/auth/me") return Promise.resolve(new Response("", { status: 401 }));
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path.startsWith("/api/auth/password-resets/") && method === "GET") {
      return Promise.resolve(new Response(JSON.stringify(state.tokenResponse), {
        status: state.tokenStatus,
        headers: { "Content-Type": "application/json" },
      }));
    }
    if (path.startsWith("/api/auth/password-resets/") && method === "POST") {
      state.completeCalls.push({ path, body: String(init?.body ?? "") });
      return Promise.resolve(new Response(
        state.completeBody ? JSON.stringify(state.completeBody) : null,
        { status: state.completeStatus },
      ));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

function setup(token = "reset-token-abc") {
  return renderWithProviders(
    <Routes>
      <Route path="/reset/:token" element={<ResetPasswordPage />} />
      <Route path="/login" element={<div>login page</div>} />
    </Routes>,
    { initialEntries: [`/reset/${token}`] },
  );
}

describe("<ResetPasswordPage>", () => {
  it("shows the set-a-new-password form for a valid token", async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /set a new password/i })).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue("user@example.com")).toBeInTheDocument();
  });

  it("shows the invalid panel when the token is not valid", async () => {
    state.tokenResponse = { valid: false };
    setup();
    await waitFor(() =>
      expect(screen.getByText(/this reset link isn't valid/i)).toBeInTheDocument()
    );
  });

  it("submits a new password (no old-password field) and redirects to login", async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /set a new password/i })).toBeInTheDocument()
    );

    // There is no "current password" field on this page.
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/new password/i), "BrandNewPass9");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "BrandNewPass9");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
    expect(state.completeCalls).toHaveLength(1);
    expect(JSON.parse(state.completeCalls[0].body)).toEqual({ password: "BrandNewPass9" });
  });

  it("keeps submit disabled until the password rules pass and match", async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /set a new password/i })).toBeInTheDocument()
    );
    const submit = screen.getByRole("button", { name: /update password/i });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/new password/i), "short");
    expect(submit).toBeDisabled(); // too short, no digit

    await userEvent.clear(screen.getByLabelText(/new password/i));
    await userEvent.type(screen.getByLabelText(/new password/i), "GoodPass12");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "Mismatch12");
    expect(submit).toBeDisabled(); // mismatch
  });
});
