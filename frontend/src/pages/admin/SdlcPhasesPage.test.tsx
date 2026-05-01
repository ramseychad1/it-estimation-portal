import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SdlcPhasesPage } from "./SdlcPhasesPage";
import { renderWithProviders } from "../../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockPhase {
  id: number;
  name: string;
  description?: string | null;
  displayOrder: number;
  active?: boolean;
  system?: boolean;
}

function listItem(p: MockPhase) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    displayOrder: p.displayOrder,
    active: p.active ?? true,
    system: p.system ?? false,
    updatedAt: new Date().toISOString(),
    updatedBy: 1,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface MockState {
  phases: MockPhase[];
  reorderRequests: number[][];
  reorderShouldFail: boolean;
  /** When set, the activate endpoint returns 409 TEMPLATES_WOULD_BE_AFFECTED. */
  activationBlockedCount: number | null;
}

let state: MockState;

function installRouter() {
  state = {
    phases: [],
    reorderRequests: [],
    reorderShouldFail: false,
    activationBlockedCount: null,
  };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

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

    if (path === "/api/admin/phases" && method === "GET") {
      return Promise.resolve(jsonResponse(state.phases.map(listItem)));
    }
    if (
      path.match(/^\/api\/admin\/phases\/\d+\/activate$/) &&
      method === "POST"
    ) {
      // Phase 5b: surface the TEMPLATES_WOULD_BE_AFFECTED rejection so
      // the page's info-modal handler exercises end-to-end.
      if (state.activationBlockedCount != null) {
        return Promise.resolve(
          jsonResponse(
            {
              error: "TEMPLATES_WOULD_BE_AFFECTED",
              message: "Activation blocked by templates",
              fieldErrors: {
                affectedTemplateCount: String(state.activationBlockedCount),
              },
            },
            409,
          ),
        );
      }
      return Promise.resolve(jsonResponse(listItem({
        ...state.phases[0],
        active: true,
      })));
    }
    if (path === "/api/admin/phases/reorder" && method === "PATCH") {
      const body = JSON.parse((init?.body as string) ?? "{}");
      state.reorderRequests.push(body.phaseIds);
      if (state.reorderShouldFail) {
        return Promise.resolve(jsonResponse({ error: "INTERNAL", message: "Boom" }, 500));
      }
      const reordered = body.phaseIds
        .map((id: number, idx: number) => {
          const p = state.phases.find((x) => x.id === id);
          return p ? { ...p, displayOrder: idx + 1 } : null;
        })
        .filter(Boolean);
      state.phases = reordered;
      return Promise.resolve(jsonResponse(state.phases.map(listItem)));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(() => installRouter());
afterEach(() => fetchMock.mockReset());

const SEEDS: MockPhase[] = [
  { id: 1, name: "Analysis", displayOrder: 1, system: true },
  { id: 2, name: "Design", displayOrder: 2, system: true },
  { id: 3, name: "Development", displayOrder: 3, system: true },
  { id: 4, name: "Testing", displayOrder: 4, system: true },
];

describe("<SdlcPhasesPage>", () => {
  it("renders rows in display_order with the System badge for system phases", async () => {
    state.phases = [...SEEDS];
    renderWithProviders(<SdlcPhasesPage />);

    await screen.findByText("Analysis");
    const rows = document.querySelectorAll("tbody tr[data-row-id]");
    const ids = Array.from(rows).map((r) => Number(r.getAttribute("data-row-id")));
    expect(ids).toEqual([1, 2, 3, 4]);
    // System badge appears for each system row.
    expect(screen.getAllByText("System").length).toBe(4);
  });

  it("hides Delete in the kebab for system phases", async () => {
    state.phases = [SEEDS[0]];
    const user = userEvent.setup();
    renderWithProviders(<SdlcPhasesPage />);
    await screen.findByText("Analysis");

    await user.click(screen.getByRole("button", { name: /actions for analysis/i }));
    expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /view history/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /deactivate/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("shows Delete in the kebab for custom (non-system) phases", async () => {
    state.phases = [{ id: 50, name: "Configuration", displayOrder: 1, system: false }];
    const user = userEvent.setup();
    renderWithProviders(<SdlcPhasesPage />);
    await screen.findByText("Configuration");

    await user.click(screen.getByRole("button", { name: /actions for configuration/i }));
    expect(await screen.findByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("'Reset filters' clears the search and status filter", async () => {
    state.phases = [...SEEDS];
    const user = userEvent.setup();
    renderWithProviders(<SdlcPhasesPage />);
    await screen.findByText("Analysis");

    const searchInput = screen.getByPlaceholderText(/search phases/i);
    await user.type(searchInput, "no-such-thing");
    await waitFor(() => {
      expect(screen.getByText(/no phases match your filters/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /reset filters/i }));
    await waitFor(() => {
      expect(screen.getByText("Analysis")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------
  // Phase 5b — activation guard
  // -------------------------------------------------------------------

  it("Activate fires TEMPLATES_WOULD_BE_AFFECTED → InfoModal shows the count", async () => {
    state.phases = [{ id: 99, name: "Hypercare", displayOrder: 5, active: false, system: false }];
    state.activationBlockedCount = 3;
    const user = userEvent.setup();
    renderWithProviders(<SdlcPhasesPage />);

    await screen.findByText("Hypercare");
    await user.click(screen.getByRole("button", { name: /actions for hypercare/i }));
    await user.click(await screen.findByRole("menuitem", { name: /^activate$/i }));

    // Info modal mounts with the affected count baked in.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/Cannot activate phase/i);
    expect(dialog).toHaveTextContent(/3 estimate templates/i);
    expect(dialog).toHaveTextContent(/'Hypercare'/);
    // Single dismissal button — no Cancel.
    expect(within(dialog).getByRole("button", { name: /Got it/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Cancel/i })).toBeNull();
  });
});
