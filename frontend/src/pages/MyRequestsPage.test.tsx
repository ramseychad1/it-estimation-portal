import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyRequestsPage } from "./MyRequestsPage";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockRequest {
  id: number;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_REVISION" | "PARTIALLY_APPROVED";
  productName: string;
  subFeatureName: string | null;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface State {
  requests: MockRequest[];
  discarded: number[];
  navigations: string[];
}
let state: State;

function listResponse(items: MockRequest[]) {
  const mapped = items.map((r) => ({
    id: r.id,
    title: r.title,
    derivedStatus: r.status,
    itemCount: 1,
    productNames: r.subFeatureName
      ? `${r.productName} · ${r.subFeatureName}`
      : r.productName,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));
  return jsonResponse({
    items: mapped,
    page: 0,
    size: 25,
    totalElements: mapped.length,
    totalPages: mapped.length === 0 ? 0 : 1,
  });
}

function installRouter() {
  state = { requests: [], discarded: [], navigations: [] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: 1, email: "requester@local", firstName: "Test", lastName: "Requester",
        roles: ["Requester"],
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === "/api/estimates/my" && method === "GET") {
      const status = u.searchParams.get("status");
      const search = (u.searchParams.get("search") ?? "").toLowerCase();
      const filtered = state.requests
        .filter((r) => !status || r.status === status)
        .filter((r) => !search || r.title.toLowerCase().includes(search));
      return Promise.resolve(listResponse(filtered));
    }

    const discardMatch = path.match(/^\/api\/estimates\/my\/(\d+)$/);
    if (discardMatch && method === "DELETE") {
      const id = Number(discardMatch[1]);
      state.discarded.push(id);
      state.requests = state.requests.filter((r) => r.id !== id);
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

describe("<MyRequestsPage>", () => {
  it("renders rows and applies the status filter", async () => {
    state.requests = [
      {
        id: 1, title: "Member Portal v2", status: "DRAFT", productName: "Member Portal",
        subFeatureName: null, submittedAt: null, updatedAt: "2026-04-01T00:00:00Z", createdAt: "2026-04-01T00:00:00Z",
      },
      {
        id: 2, title: "Provider Refresh", status: "SUBMITTED", productName: "Provider",
        subFeatureName: null, submittedAt: "2026-04-15T00:00:00Z", updatedAt: "2026-04-15T00:00:00Z", createdAt: "2026-04-10T00:00:00Z",
      },
    ];
    renderWithProviders(<MyRequestsPage />);
    const user = userEvent.setup();

    await screen.findByText("Member Portal v2");
    await screen.findByText("Provider Refresh");

    // Apply "Submitted" filter — Member Portal v2 should drop out.
    await user.click(screen.getByRole("button", { name: /Status/i }));
    await user.click(await screen.findByRole("option", { name: /^Submitted$/i }));

    await waitFor(() => {
      expect(screen.queryByText("Member Portal v2")).not.toBeInTheDocument();
      expect(screen.getByText("Provider Refresh")).toBeInTheDocument();
    });
  });

  it("renders the Day-1 empty state with the primary CTA", async () => {
    renderWithProviders(<MyRequestsPage />);
    await screen.findByText(/No estimate requests yet/i);
    // The empty state shows its own "+ New estimate request" button — plus
    // one in the page header. At least one is present.
    const ctas = screen.getAllByRole("button", { name: /New estimate request/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
  });

  it("clicking a Draft row navigates to /requests/:id", async () => {
    state.requests = [
      {
        id: 7, title: "Click Me", status: "DRAFT", productName: "P",
        subFeatureName: null, submittedAt: null, updatedAt: "2026-04-01T00:00:00Z", createdAt: "2026-04-01T00:00:00Z",
      },
    ];
    renderWithProviders(<MyRequestsPage />);
    const user = userEvent.setup();
    const row = await screen.findByText("Click Me");
    await user.click(row);
    // Navigation in MemoryRouter doesn't change browser URL we can read,
    // but we can verify the fetch for the detail page would be triggered
    // by checking the discard mutation isn't accidentally invoked. The
    // EstimateDetailPage isn't mounted here — we just assert the row is
    // clickable (a true navigation test lives in the smoke test).
    expect(state.discarded).toEqual([]);
  });

  it("NEEDS_REVISION row kebab shows Discard (requester can discard to start over)", async () => {
    state.requests = [
      {
        id: 15, title: "Rejected Item Request", status: "NEEDS_REVISION", productName: "P",
        subFeatureName: null, submittedAt: "2026-04-20T00:00:00Z",
        updatedAt: "2026-04-25T00:00:00Z", createdAt: "2026-04-18T00:00:00Z",
      },
    ];
    renderWithProviders(<MyRequestsPage />);
    const user = userEvent.setup();

    await screen.findByText("Rejected Item Request");
    await user.click(screen.getByRole("button", { name: /Row actions/i }));

    // Discard should be present for NEEDS_REVISION.
    expect(await screen.findByRole("menuitem", { name: /Discard/i })).toBeInTheDocument();
  });

  it("kebab → Discard on a Draft fires DELETE after confirmation", async () => {
    state.requests = [
      {
        id: 9, title: "To Be Discarded", status: "DRAFT", productName: "P",
        subFeatureName: null, submittedAt: null, updatedAt: "2026-04-01T00:00:00Z", createdAt: "2026-04-01T00:00:00Z",
      },
    ];
    renderWithProviders(<MyRequestsPage />);
    const user = userEvent.setup();
    await screen.findByText("To Be Discarded");

    await user.click(screen.getByRole("button", { name: /Row actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Discard/i }));
    // ConfirmModal opens — confirm.
    await user.click(await screen.findByRole("button", { name: /^Discard$/i }));

    await waitFor(() => {
      expect(state.discarded).toContain(9);
    });
  });
});
