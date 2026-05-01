import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsersPage } from "./UsersPage";
import { renderWithProviders } from "../../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  invitationStatus: "ACTIVE" | "PENDING_INVITE" | "INACTIVE";
  roles: string[];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mapList(u: MockUser) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    invitationStatus: u.invitationStatus,
    active: u.invitationStatus === "ACTIVE",
    roles: u.roles,
    lastActiveAt: null,
    createdAt: new Date().toISOString(),
  };
}

function mapDetail(u: MockUser) {
  return {
    ...mapList(u),
    invitedAt: u.invitationStatus === "PENDING_INVITE" ? new Date().toISOString() : null,
    invitedBy: u.invitationStatus === "PENDING_INVITE" ? 1 : null,
    invitationExpiresAt: u.invitationStatus === "PENDING_INVITE"
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null,
    invitationAcceptedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

interface State {
  users: MockUser[];
  invitedBodies: unknown[];
  deleteRequests: { id: number; confirmationName: string }[];
}

let state: State;

function installRouter() {
  state = { users: [], invitedBodies: [], deleteRequests: [] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: 1, email: "admin@local", firstName: "Local", lastName: "Admin", roles: ["Admin"],
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === "/api/admin/users" && method === "GET") {
      const activeAdminCount = state.users.filter(
        (u) => u.invitationStatus === "ACTIVE" && u.roles.includes("Admin"),
      ).length;
      return Promise.resolve(jsonResponse({
        items: state.users.map(mapList),
        page: 0,
        size: 25,
        totalElements: state.users.length,
        totalPages: state.users.length === 0 ? 0 : 1,
        meta: { activeAdminCount },
      }));
    }

    const detailMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
    if (detailMatch) {
      const id = Number(detailMatch[1]);
      const user = state.users.find((u) => u.id === id);
      if (method === "GET" && user) return Promise.resolve(jsonResponse(mapDetail(user)));
      if (method === "DELETE" && user) {
        const body = JSON.parse((init?.body as string) ?? "{}");
        state.deleteRequests.push({ id, confirmationName: body.confirmationName });
        state.users = state.users.filter((u) => u.id !== id);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
    }

    if (path === "/api/admin/users/invitations" && method === "POST") {
      const body = JSON.parse((init?.body as string) ?? "{}");
      state.invitedBodies.push(body);
      const newUser: MockUser = {
        id: state.users.length + 100,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        invitationStatus: "PENDING_INVITE",
        roles: ["Estimator"],
      };
      state.users.push(newUser);
      return Promise.resolve(jsonResponse({
        user: mapDetail(newUser),
        inviteUrl: `http://test.local/invite/test-token-${newUser.id}`,
        tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }, 201));
    }

    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(() => installRouter());
afterEach(() => fetchMock.mockReset());

const SOLE_ADMIN: MockUser = {
  id: 1, email: "admin@local", firstName: "Local", lastName: "Admin",
  invitationStatus: "ACTIVE", roles: ["Admin"],
};

describe("<UsersPage>", () => {
  it("renders rows with the right name+email/pending treatment", async () => {
    state.users = [
      SOLE_ADMIN,
      {
        id: 2, email: "iris@local", firstName: "Iris", lastName: "Pending",
        invitationStatus: "PENDING_INVITE", roles: ["Estimator"],
      },
    ];
    renderWithProviders(<UsersPage />);
    expect(await screen.findByText("Local Admin")).toBeInTheDocument();
    // Pending user shows email on top + "Invitation pending" below.
    expect(screen.getByText("iris@local")).toBeInTheDocument();
    expect(screen.getByText("Invitation pending")).toBeInTheDocument();
  });

  it("Invite User flow: opens modal → submits → shows the Invite Created modal with copy URL", async () => {
    state.users = [SOLE_ADMIN];
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    await screen.findByText("Local Admin");

    await user.click(screen.getByRole("button", { name: /invite user/i }));
    const modal = await screen.findByRole("dialog", { name: /invite user/i });

    await user.type(within(modal).getByLabelText(/^email/i), "new@local");
    await user.type(within(modal).getByLabelText(/first name/i), "New");
    await user.type(within(modal).getByLabelText(/last name/i), "Person");
    await user.click(within(modal).getByRole("checkbox", { name: /estimator/i }));
    await user.click(within(modal).getByRole("button", { name: /send invite/i }));

    await waitFor(() => expect(state.invitedBodies.length).toBe(1));
    // First modal closes, second opens.
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /^invite user$/i })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("dialog", { name: /invite created/i })).toBeInTheDocument();
    expect(screen.getByText(/test-token-/)).toBeInTheDocument();
  });

  it("renders the last-admin banner when editing the only Admin", async () => {
    state.users = [SOLE_ADMIN];
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    await screen.findByText("Local Admin");
    await user.click(screen.getByText("Local Admin"));

    expect(await screen.findByText(/last admin in this workspace/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /invite another admin/i })).toBeInTheDocument();
  });

  it("delete confirmation requires typing the user's full name", async () => {
    state.users = [
      SOLE_ADMIN,
      {
        id: 2, email: "old@local", firstName: "Former", lastName: "User",
        invitationStatus: "INACTIVE", roles: ["Estimator"],
      },
    ];
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    await screen.findByText("Former User");

    // Open kebab → Delete user (only on inactive users).
    await user.click(screen.getByRole("button", { name: /actions for former user/i }));
    await user.click(await screen.findByRole("menuitem", { name: /delete user/i }));

    const modal = await screen.findByRole("alertdialog", { name: /permanently delete former user/i });
    const confirm = within(modal).getByRole("button", { name: /permanently delete/i });
    expect(confirm).toBeDisabled();

    const input = within(modal).getByLabelText(/type the user's full name/i);
    await user.type(input, "wrong name");
    expect(confirm).toBeDisabled();

    await user.clear(input);
    await user.type(input, "Former User");
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    await waitFor(() => expect(state.deleteRequests.length).toBe(1));
    expect(state.deleteRequests[0].confirmationName).toBe("Former User");
  });

  it("pending-invite user opens the Pending Invite drawer (not the edit drawer)", async () => {
    state.users = [
      SOLE_ADMIN,
      {
        id: 2, email: "iris@local", firstName: "Iris", lastName: "Pending",
        invitationStatus: "PENDING_INVITE", roles: ["Estimator"],
      },
    ];
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    await screen.findByText("iris@local");
    await user.click(screen.getByText("iris@local"));

    expect(
      await screen.findByRole("dialog", { name: /pending invite: iris pending/i }),
    ).toBeInTheDocument();
    // Edit-drawer-only sections are absent.
    expect(screen.queryByText(/profile/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revoke invitation/i })).toBeInTheDocument();
  });
});
