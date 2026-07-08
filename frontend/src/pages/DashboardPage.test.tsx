import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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
  summaryCards: { key: string; label: string; count: number; description?: string }[];
}

let state: RouterState;

function installRouter() {
  state = {
    meRoles: ["Admin", "Solution Owner", "Estimator", "Requester"],
    summaryCards: [
      { key: "awaitingReview", label: "Awaiting review", count: 3, description: "Submitted estimate requests with no SO claim yet" },
      { key: "myActiveReviews", label: "My active reviews", count: 1 },
      { key: "myDrafts", label: "My drafts", count: 4 },
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
      const cards = state.summaryCards.filter((c) => {
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
      const size = Number(u.searchParams.get("size") ?? 20);
      const all = [
        { id: 1, timestamp: "2026-07-09T10:00:00Z", actor: { id: 1, name: "Sarah Admin" },
          description: "Sarah Admin approved an item on Estimate request 'Portal Rollout'",
          entityType: "EstimateRequest", entityHref: "/requests/9", actionLabel: "Item approved" },
        { id: 2, timestamp: "2026-07-09T09:00:00Z", actor: { id: 2, name: "John SO" },
          description: "John SO started reviewing an item on Estimate request 'Portal Rollout'",
          entityType: "EstimateRequest", entityHref: "/requests/9", actionLabel: "Item review started" },
      ];
      const rows = mineOnly ? all.filter((r) => r.actor.id === 1) : all;
      return Promise.resolve(jsonResponse({
        items: rows.slice(0, size), page: 0, size,
        totalElements: rows.length, totalPages: 1,
      }));
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
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Awaiting review");
    expect(cards[0]).toHaveTextContent("3");
    expect(cards[2]).toHaveTextContent("My drafts");
    expect(cards[2]).toHaveTextContent("4");
  });

  it("emphasizes actionable non-zero cards with the accent treatment", async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => expect(screen.getAllByTestId("stat-card").length).toBeGreaterThan(0));
    const cards = screen.getAllByTestId("stat-card");
    // awaitingReview count=3 -> emphasized; myDrafts is not an attention card.
    expect(cards[0]).toHaveAttribute("data-emphasized", "true");
    expect(cards[2]).not.toHaveAttribute("data-emphasized");
  });

  it("renders the activity feed and filters with Just mine", async () => {
    renderWithProviders(<DashboardPage />);

    // Both rows render, descriptions are humanized (no raw enums).
    expect(await screen.findByText(/approved an item on Estimate request 'Portal Rollout'/i)).toBeInTheDocument();
    expect(screen.getByText(/started reviewing an item/i)).toBeInTheDocument();
    expect(screen.queryByText(/ITEM_REVIEW_STARTED/)).not.toBeInTheDocument();

    // Just mine narrows to the viewer's own rows.
    await userEvent.click(screen.getByRole("switch", { name: /Just mine/i }));
    await waitFor(() => {
      expect(screen.queryByText(/started reviewing an item/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/approved an item on/i)).toBeInTheDocument();
  });

  it("Refresh button triggers refetch of summary", async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => expect(screen.getAllByTestId("stat-card").length).toBeGreaterThan(0));

    const before = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/dashboard/summary"),
    ).length;

    await userEvent.click(screen.getByTestId("dashboard-refresh"));

    await waitFor(() => {
      const after = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/api/dashboard/summary"),
      ).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it("renders only the quick links the user's roles unlock", async () => {
    state.meRoles = ["Requester"];
    renderWithProviders(<DashboardPage />);

    await screen.findAllByTestId("quick-link-tile");
    await waitFor(() => {
      expect(screen.getAllByTestId("quick-link-tile")).toHaveLength(2);
    });
    const tiles = screen.getAllByTestId("quick-link-tile");
    const tileTitles = tiles.map((t) => t.textContent);
    expect(tileTitles.some((t) => t?.includes("New estimate request"))).toBe(true);
    expect(tileTitles.some((t) => t?.includes("My estimate requests"))).toBe(true);
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

  it("'Needs revision' stat card links to /requests?status=NEEDS_REVISION", async () => {
    state.summaryCards = [
      ...state.summaryCards,
      { key: "needsRevision", label: "Needs revision", count: 2, description: "Your requests with at least one rejected item" },
    ];
    renderWithProviders(<DashboardPage />);

    await waitFor(() => expect(screen.getAllByTestId("stat-card").length).toBeGreaterThan(0));
    const card = screen.getByText("Needs revision").closest("[data-testid='stat-card']")!;
    expect(card).toHaveTextContent("2");

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
});
