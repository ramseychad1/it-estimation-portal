import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamsPage } from "./TeamsPage";
import { renderWithProviders } from "../../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockTeam {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  productCount?: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
}

function pageResponse(items: MockTeam[]) {
  return {
    items: items.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      active: t.active,
      productCount: t.productCount ?? 0,
      updatedAt: t.updatedAt ?? new Date().toISOString(),
      updatedBy: t.updatedBy ?? 1,
    })),
    page: 0,
    size: 25,
    totalElements: items.length,
    totalPages: 1,
  };
}

function dto(team: MockTeam) {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    active: team.active,
    createdAt: new Date().toISOString(),
    createdBy: 1,
    updatedAt: team.updatedAt ?? new Date().toISOString(),
    updatedBy: team.updatedBy ?? 1,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface MockState {
  teams: MockTeam[];
  postedBodies: unknown[];
  deletedIds: number[];
}

let state: MockState;

function installRouter() {
  state = { teams: [], postedBodies: [], deletedIds: [] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    // /api/auth/me — pretend authed (avoids AuthGuard noise even though we
    // render TeamsPage directly outside the guard in these tests).
    if (path === "/api/auth/me") {
      return Promise.resolve(
        jsonResponse({
          id: 1,
          email: "admin@local",
          firstName: "Local",
          lastName: "Admin",
          roles: ["Admin"],
        }),
      );
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === "/api/admin/teams" && method === "GET") {
      return Promise.resolve(jsonResponse(pageResponse(state.teams)));
    }
    if (path === "/api/admin/teams" && method === "POST") {
      const body = JSON.parse((init?.body as string) ?? "{}");
      state.postedBodies.push({ kind: "create", body });
      const created = {
        id: state.teams.length + 100,
        name: body.name,
        description: body.description ?? null,
        active: body.active ?? true,
      };
      state.teams.push(created);
      return Promise.resolve(jsonResponse(dto(created), 201));
    }
    const idMatch = path.match(/^\/api\/admin\/teams\/(\d+)$/);
    if (idMatch) {
      const id = Number(idMatch[1]);
      const team = state.teams.find((t) => t.id === id);
      if (method === "GET" && team) return Promise.resolve(jsonResponse(dto(team)));
      if (method === "DELETE" && team) {
        state.deletedIds.push(id);
        state.teams = state.teams.filter((t) => t.id !== id);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(() => installRouter());
afterEach(() => fetchMock.mockReset());

describe("<TeamsPage>", () => {
  it("renders the rows returned by the list query", async () => {
    state.teams = [
      { id: 1, name: "Backend Platform", description: "Owns shared services", active: true },
      { id: 2, name: "Mobile", description: "iOS + Android", active: false },
    ];
    renderWithProviders(<TeamsPage />);
    expect(await screen.findByText("Backend Platform")).toBeInTheDocument();
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    // Status badges render per row.
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("clicking '+ New team' opens the create drawer", async () => {
    state.teams = [];
    const user = userEvent.setup();
    renderWithProviders(<TeamsPage />);
    // Wait for initial query to settle so the empty-state CTA is the one we click.
    await screen.findByText(/no teams yet/i);
    await user.click(
      screen.getAllByRole("button", { name: /^new team$/i })[0],
    );
    expect(await screen.findByRole("dialog", { name: /new team/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
  });

  it("submitting a valid create form fires POST and refetches the list", async () => {
    state.teams = [];
    const user = userEvent.setup();
    renderWithProviders(<TeamsPage />);
    await screen.findByText(/no teams yet/i);
    await user.click(screen.getAllByRole("button", { name: /^new team$/i })[0]);

    const drawer = await screen.findByRole("dialog", { name: /new team/i });
    await user.type(within(drawer).getByLabelText(/^name/i), "Brand New Team");
    await user.click(within(drawer).getByRole("button", { name: /^create team$/i }));

    await waitFor(() => {
      expect(state.postedBodies.length).toBe(1);
    });
    expect((state.postedBodies[0] as { body: { name: string } }).body.name).toBe(
      "Brand New Team",
    );
    // After invalidation, the new row appears in the table.
    await waitFor(() => {
      expect(screen.getByText("Brand New Team")).toBeInTheDocument();
    });
    // Drawer should have closed.
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /new team/i })).not.toBeInTheDocument();
    });
  });

  it("delete from the kebab opens the confirm modal; confirming deletes the team", async () => {
    state.teams = [
      { id: 7, name: "Goner", description: null, active: true },
    ];
    const user = userEvent.setup();
    renderWithProviders(<TeamsPage />);
    await screen.findByText("Goner");

    await user.click(screen.getByRole("button", { name: /actions for goner/i }));
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));

    const modal = await screen.findByRole("alertdialog", { name: /delete 'goner'/i });
    expect(modal).toBeInTheDocument();

    await user.click(within(modal).getByRole("button", { name: /delete team/i }));
    await waitFor(() => {
      expect(state.deletedIds).toContain(7);
    });
  });

  it("selecting rows swaps the toolbar into bulk mode", async () => {
    state.teams = [
      { id: 1, name: "Alpha", description: null, active: true },
      { id: 2, name: "Beta", description: null, active: true },
    ];
    const user = userEvent.setup();
    renderWithProviders(<TeamsPage />);
    await screen.findByText("Alpha");

    await user.click(screen.getByLabelText(/select row 1/i));
    expect(await screen.findByText(/^1 selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^activate$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^deactivate$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear selection/i })).toBeInTheDocument();
  });
});
