import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcceptInvitePage } from "./AcceptInvitePage";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_TOKEN_RESPONSE = { valid: true, email: "invited@example.com", expiresAt: "2030-01-01T00:00:00Z" };
const INVALID_TOKEN_RESPONSE = { valid: false };

type FetchState = {
  tokenResponse: unknown;
  tokenStatus: number;
  acceptResponse: unknown;
  acceptStatus: number;
};

let state: FetchState;

function installRouter() {
  state = {
    tokenResponse: VALID_TOKEN_RESPONSE,
    tokenStatus: 200,
    acceptResponse: { email: "invited@example.com" },
    acceptStatus: 200,
  };

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    // AuthProvider — unauthenticated public page
    if (path === "/api/auth/me") {
      return Promise.resolve(new Response("", { status: 401 }));
    }
    // primeCsrfToken
    if (path === "/api/health") {
      return Promise.resolve(jsonResponse({ status: "ok" }));
    }
    // Validate token
    if (path.startsWith("/api/auth/invitations/") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(state.tokenResponse), {
          status: state.tokenStatus,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    // Accept invitation
    if (path.startsWith("/api/auth/invitations/") && method === "POST") {
      return Promise.resolve(
        new Response(JSON.stringify(state.acceptResponse), {
          status: state.acceptStatus,
          headers: { "Content-Type": "application/json" },
        })
      );
    }

    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

function setup(token = "valid-token-abc123") {
  return renderWithProviders(
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvitePage />} />
      <Route path="/login" element={<div>login page</div>} />
    </Routes>,
    { initialEntries: [`/invite/${token}`] },
  );
}

// ---------- Token validation states -----------------------------------------

describe("<AcceptInvitePage> — token validation", () => {
  it("shows loading state while token is being validated", () => {
    // Override to never resolve so loading state persists
    fetchMock.mockImplementation((url: string) => {
      const u = new URL(url, "http://localhost");
      const path = u.pathname;
      if (path === "/api/auth/me") return Promise.resolve(new Response("", { status: 401 }));
      if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));
      // Never resolve the token validation
      return new Promise(() => {});
    });
    setup();
    expect(screen.getByText("Checking invitation…")).toBeInTheDocument();
  });

  it("shows valid form after token is validated", async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByText("Set your password")).toBeInTheDocument()
    );
    // Email field shows the invited email (read-only)
    expect(screen.getByDisplayValue("invited@example.com")).toBeInTheDocument();
  });

  it("shows the 'Set your password' heading for a valid token", async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /set your password/i })).toBeInTheDocument()
    );
  });

  it("shows invalid token panel when token.valid is false", async () => {
    state.tokenResponse = INVALID_TOKEN_RESPONSE;
    setup();
    await waitFor(() =>
      expect(screen.getByText(/this invitation isn't valid/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/return to sign in/i)).toBeInTheDocument();
  });

  it("shows invalid token panel when validation returns 404", async () => {
    state.tokenStatus = 404;
    state.tokenResponse = { message: "Not found" };
    setup();
    await waitFor(() =>
      expect(screen.getByText(/this invitation isn't valid/i)).toBeInTheDocument()
    );
  });
});

// ---------- Password rules hints --------------------------------------------

describe("<AcceptInvitePage> — password rules", () => {
  it("shows all three password rule hints once form is visible", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Set your password")).toBeInTheDocument());
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("Contains a letter")).toBeInTheDocument();
    expect(screen.getByText("Contains a digit")).toBeInTheDocument();
  });

  it("submit button is disabled when no password entered", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Set your password")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /set password and sign in/i })).toBeDisabled();
  });

  it("submit is still disabled when only short password entered (< 8 chars)", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByText("Set your password")).toBeInTheDocument());
    const passwordInput = screen.getAllByLabelText(/password/i)[0];
    await user.type(passwordInput, "Ab1");
    expect(screen.getByRole("button", { name: /set password and sign in/i })).toBeDisabled();
  });

  it("submit is still disabled when passwords do not match", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByText("Set your password")).toBeInTheDocument());
    const inputs = screen.getAllByLabelText(/password/i);
    await user.type(inputs[0], "Passw0rd!");
    await user.type(inputs[1], "DifferentPassword1");
    expect(screen.getByRole("button", { name: /set password and sign in/i })).toBeDisabled();
  });

  it("shows 'Passwords do not match' error when confirm differs", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByText("Set your password")).toBeInTheDocument());
    const inputs = screen.getAllByLabelText(/password/i);
    await user.type(inputs[0], "Passw0rd!");
    await user.type(inputs[1], "NotMatching1");
    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    );
  });

  it("enables submit button when all rules are met and passwords match", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByText("Set your password")).toBeInTheDocument());
    const inputs = screen.getAllByLabelText(/password/i);
    await user.type(inputs[0], "Passw0rd!");
    await user.type(inputs[1], "Passw0rd!");
    expect(screen.getByRole("button", { name: /set password and sign in/i })).not.toBeDisabled();
  });
});

// ---------- Form submission -------------------------------------------------

describe("<AcceptInvitePage> — form submission", () => {
  async function fillAndSubmit(token = "valid-token-abc123") {
    const user = userEvent.setup();
    setup(token);
    await waitFor(() => expect(screen.getByText("Set your password")).toBeInTheDocument());
    const inputs = screen.getAllByLabelText(/password/i);
    await user.type(inputs[0], "Passw0rd!");
    await user.type(inputs[1], "Passw0rd!");
    await user.click(screen.getByRole("button", { name: /set password and sign in/i }));
    return user;
  }

  it("calls the accept endpoint with token and password on submit", async () => {
    await fillAndSubmit("abc123");
    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const acceptCall = calls.find(
        (args: unknown[]) => {
          const [url, init] = args as [string, RequestInit];
          return url.includes("abc123") && (init?.method ?? "GET").toUpperCase() === "POST";
        }
      );
      expect(acceptCall).toBeDefined();
    });
  });

  it("redirects to /login after successful submission", async () => {
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
  });

  it("displays server error message on API failure (400)", async () => {
    state.acceptStatus = 400;
    state.acceptResponse = { message: "Token has already been used." };
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText("Token has already been used.")).toBeInTheDocument()
    );
  });

  it("displays generic error for non-OK response without message", async () => {
    state.acceptStatus = 500;
    state.acceptResponse = {};
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText("Could not accept the invitation.")).toBeInTheDocument()
    );
  });

  it("shows pending state during submission (button text changes)", async () => {
    // Override accept to never resolve
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = new URL(url, "http://localhost");
      const path = u.pathname;
      const method = (init?.method ?? "GET").toUpperCase();
      if (path === "/api/auth/me") return Promise.resolve(new Response("", { status: 401 }));
      if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));
      if (method === "GET") return Promise.resolve(jsonResponse(VALID_TOKEN_RESPONSE));
      // POST (accept) — never resolves
      return new Promise(() => {});
    });

    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByText("Set your password")).toBeInTheDocument());
    const inputs = screen.getAllByLabelText(/password/i);
    await user.type(inputs[0], "Passw0rd!");
    await user.type(inputs[1], "Passw0rd!");
    await user.click(screen.getByRole("button", { name: /set password and sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /setting password/i })).toBeInTheDocument()
    );
  });
});
