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
