import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPage } from "./DashboardPage";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface RouterState {
  meRoles: string[];
  summaryAll: { key: string; label: string; count: number; description?: string }[];
  activityAll: ActivityRow[];
  activityMine: ActivityRow[];
}

interface ActivityRow {
  id: number;
  timestamp: string;
  actor: { id: number; name: string };
  description: string;
  entityType: string;
  entityHref: string | null;
  actionLabel: string;
}

let state: RouterState;

function pageResponse(items: ActivityRow[], page = 0, size = 20) {
  return jsonResponse({
    items,
    page,
    size,
    totalElements: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  });
}

function installRouter() {
  state = {
    meRoles: ["Admin", "Solution Owner", "Estimator", "Requester"],
    summaryAll: [
      { key: "awaitingReview", label: "Awaiting review", count: 3, description: "Submitted estimate requests with no SO claim yet" },
      { key: "myActiveReviews", label: "My active reviews", count: 1 },
      { key: "myDrafts", label: "My drafts", count: 4 },
      { key: "myRecentActivity", label: "My activity (7 days)", count: 12 },
    ],
    activityAll: [
      {
        id: 1, timestamp: new Date().toISOString(),
        actor: { id: 7, name: "Sara Sage" },
        description: "Sara Sage submitted Estimate request 'Member Portal v2'",
        entityType: "EstimateRequest",
        entityHref: "/requests/42",
        actionLabel: "Submitted",
      },
      {
        id: 2, timestamp: new Date(Date.now() - 86_400_000).toISOString(),
        actor: { id: 9, name: "Riley Reqs" },
        description: "Riley Reqs created Estimate request 'Provider Refresh'",
        entityType: "EstimateRequest",
        entityHref: "/requests/43",
        actionLabel: "Created",
      },
    ],
    activityMine: [
      {
        id: 99, timestamp: new Date().toISOString(),
        actor: { id: 1, name: "Local Admin" },
        description: "Local Admin created Product 'Eligibility'",
        entityType: "Product",
        entityHref: "/catalog/products/12",
        actionLabel: "Created",
      },
    ],
  };

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: 1, email: "admin@local", firstName: "Sarah", lastName: "Admin",
        roles: state.meRoles,
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === "/api/dashboard/summary" && method === "GET") {
      // Filter cards by role-aware visibility, mirroring the backend.
      const cards = state.summaryAll.filter((c) => {
        if (c.key === "awaitingReview" || c.key === "myActiveReviews") {
          return state.meRoles.includes("Solution Owner");
        }
        if (c.key === "pendingInvitations" || c.key === "totalActiveUsers") {
          return state.meRoles.includes("Admin");
        }
        return true;
      });
      return Promise.resolve(jsonResponse({ cards }));
    }

    if (path === "/api/dashboard/activity" && method === "GET") {
      const mineOnly = u.searchParams.get("mineOnly") === "true";
      const items = mineOnly ? state.activityMine : state.activityAll;
      return Promise.resolve(pageResponse(items));
    }

    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

describe("<DashboardPage>", () => {
  it("renders stat cards from API response", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => expect(screen.getAllByTestId("stat-card").length).toBeGreaterThan(0));
    const cards = screen.getAllByTestId("stat-card");
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveTextContent("Awaiting review");
    expect(cards[0]).toHaveTextContent("3");
    expect(cards[2]).toHaveTextContent("My drafts");
    expect(cards[2]).toHaveTextContent("4");
  });

  it("renders activity feed rows with descriptions", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() =>
      expect(
        screen.queryByText(/submitted Estimate request 'Member Portal v2'/),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/created Estimate request 'Provider Refresh'/),
    ).toBeInTheDocument();
  });

  it("'Just mine' toggle changes the activity query", async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText(/Member Portal v2/);

    await userEvent.click(screen.getByRole("button", { name: /just mine/i }));

    await waitFor(() =>
      expect(screen.getByText(/created Product 'Eligibility'/)).toBeInTheDocument(),
    );
    // The "All activity" rows should no longer be in the DOM.
    expect(screen.queryByText(/Member Portal v2/)).not.toBeInTheDocument();
  });

  it("Refresh button triggers refetch of summary + activity", async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText(/Member Portal v2/);

    // Capture call counts BEFORE clicking refresh, then verify they
    // increase. The refresh handler invalidates both query keys.
    const beforeSummary = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/dashboard/summary"),
    ).length;
    const beforeActivity = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/dashboard/activity"),
    ).length;

    await userEvent.click(screen.getByTestId("dashboard-refresh"));

    await waitFor(() => {
      const afterSummary = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/api/dashboard/summary"),
      ).length;
      const afterActivity = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/api/dashboard/activity"),
      ).length;
      expect(afterSummary).toBeGreaterThan(beforeSummary);
      expect(afterActivity).toBeGreaterThan(beforeActivity);
    });
  });

  it("renders only the quick links the user's roles unlock", async () => {
    // Single-role Requester: only the two Requester tiles render.
    state.meRoles = ["Requester"];
    renderWithProviders(<DashboardPage />);

    // Wait for the auth query AND the tiles to render. Using
    // findAllByTestId polls until at least one tile appears.
    await screen.findAllByTestId("quick-link-tile");
    await waitFor(() => {
      expect(screen.getAllByTestId("quick-link-tile")).toHaveLength(2);
    });
    const tiles = screen.getAllByTestId("quick-link-tile");
    const tileTitles = tiles.map((t) => t.textContent);
    expect(tileTitles.some((t) => t?.includes("New estimate request"))).toBe(true);
    expect(tileTitles.some((t) => t?.includes("My estimate requests"))).toBe(true);
    // No SO or Admin tiles.
    expect(tileTitles.some((t) => t?.includes("Review queue"))).toBe(false);
    expect(tileTitles.some((t) => t?.includes("Manage users"))).toBe(false);
  });

  it("multi-role user sees all six quick links", async () => {
    state.meRoles = ["Admin", "Solution Owner", "Requester"];
    renderWithProviders(<DashboardPage />);

    await screen.findAllByTestId("quick-link-tile");
    await waitFor(() => {
      expect(screen.getAllByTestId("quick-link-tile")).toHaveLength(6);
    });
  });

  it("empty activity feed shows the empty state", async () => {
    state.activityAll = [];
    renderWithProviders(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByTestId("activity-empty-state")).toBeInTheDocument(),
    );
    expect(screen.getByText(/No activity yet/i)).toBeInTheDocument();
  });

  it("'Needs revision' stat card links to /requests?status=NEEDS_REVISION", async () => {
    // Seed a needsRevision card that the backend sends for Requesters.
    state.summaryAll = [
      ...state.summaryAll,
      { key: "needsRevision", label: "Needs revision", count: 2, description: "Your requests with at least one rejected item" },
    ];
    renderWithProviders(<DashboardPage />);

    // Wait for cards to render.
    await waitFor(() => expect(screen.getAllByTestId("stat-card").length).toBeGreaterThan(0));
    const card = screen.getByText("Needs revision").closest("[data-testid='stat-card']")!;
    expect(card).toHaveTextContent("2");

    // The card should be wrapped in a Link pointing to the correct URL.
    const link = card.closest("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/requests?status=NEEDS_REVISION");
  });

  it("renders a time-of-day greeting using the user's first name", async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/^Good (morning|afternoon|evening), Sarah\.$/),
      ).toBeInTheDocument(),
    );
  });

  it("only shows the activity scope toggle inside the activity section", async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText(/Member Portal v2/);
    const activitySection = screen.getByTestId("dashboard-activity");
    expect(within(activitySection).getByTestId("activity-scope")).toBeInTheDocument();
  });
});
