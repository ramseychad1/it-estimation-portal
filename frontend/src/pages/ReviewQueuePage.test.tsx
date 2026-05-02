import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewQueuePage } from "./ReviewQueuePage";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockRow {
  id: number;
  title: string;
  status: "SUBMITTED" | "IN_REVIEW";
  productName: string;
  reviewerId: number | null;
  submittedAt: string;
}

interface State {
  rows: MockRow[];
  starts: number[];
}
let state: State;
let currentSoId = 1;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function listResponse(items: MockRow[]) {
  return jsonResponse({
    items: items.map((r) => ({
      id: r.id,
      title: r.title,
      productId: 1,
      productName: r.productName,
      subFeatureId: null,
      subFeatureName: null,
      status: r.status,
      submittedAt: r.submittedAt,
      updatedAt: r.submittedAt,
      createdAt: r.submittedAt,
    })),
    page: 0,
    size: 25,
    totalElements: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  });
}

function installRouter() {
  state = { rows: [], starts: [] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: currentSoId, email: "so1@local", firstName: "SO", lastName: "One",
        roles: ["Solution Owner"],
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === "/api/catalog/products" && method === "GET") {
      return Promise.resolve(jsonResponse({
        items: [], page: 0, size: 200, totalElements: 0, totalPages: 0,
      }));
    }

    if (path === "/api/estimates/review" && method === "GET") {
      const status = u.searchParams.get("status");
      const search = (u.searchParams.get("search") ?? "").toLowerCase();
      const mine = u.searchParams.get("mineOnly") === "true";
      const filtered = state.rows
        .filter((r) => !status || r.status === status)
        .filter((r) => !search || r.title.toLowerCase().includes(search))
        .filter((r) => !mine || r.reviewerId === currentSoId);
      return Promise.resolve(listResponse(filtered));
    }

    const startMatch = path.match(/^\/api\/estimates\/review\/(\d+)\/start$/);
    if (startMatch && method === "POST") {
      const id = Number(startMatch[1]);
      state.starts.push(id);
      const row = state.rows.find((r) => r.id === id);
      if (row) {
        row.status = "IN_REVIEW";
        row.reviewerId = currentSoId;
      }
      return Promise.resolve(jsonResponse({ id, status: "IN_REVIEW" }));
    }

    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

function renderQueue() {
  return renderWithProviders(
    <Routes>
      <Route path="/review" element={<ReviewQueuePage />} />
      <Route path="/review/:id" element={<DetailStub />} />
    </Routes>,
    { initialEntries: ["/review"] },
  );
}

function DetailStub() {
  return <div data-testid="review-detail-stub" />;
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

describe("<ReviewQueuePage>", () => {
  it("lists Submitted and In Review rows together by default", async () => {
    state.rows = [
      {
        id: 1, title: "Submitted Member Portal", status: "SUBMITTED",
        productName: "Member", reviewerId: null,
        submittedAt: "2026-04-01T00:00:00Z",
      },
      {
        id: 2, title: "Claimed by SO1", status: "IN_REVIEW",
        productName: "Provider", reviewerId: 1,
        submittedAt: "2026-04-02T00:00:00Z",
      },
    ];
    renderQueue();
    await screen.findByText("Submitted Member Portal");
    expect(screen.getByText("Claimed by SO1")).toBeInTheDocument();
  });

  it("status filter narrows to Submitted only", async () => {
    state.rows = [
      {
        id: 1, title: "Submitted A", status: "SUBMITTED",
        productName: "P", reviewerId: null,
        submittedAt: "2026-04-01T00:00:00Z",
      },
      {
        id: 2, title: "In Review B", status: "IN_REVIEW",
        productName: "P", reviewerId: 1,
        submittedAt: "2026-04-02T00:00:00Z",
      },
    ];
    renderQueue();
    const user = userEvent.setup();

    await screen.findByText("Submitted A");
    await user.click(screen.getByRole("button", { name: /Status/i }));
    await user.click(await screen.findByRole("option", { name: /^Submitted$/i }));

    await waitFor(() => {
      expect(screen.getByText("Submitted A")).toBeInTheDocument();
      expect(screen.queryByText("In Review B")).not.toBeInTheDocument();
    });
  });

  it("Mine only toggle filters to caller's claimed reviews", async () => {
    state.rows = [
      {
        id: 1, title: "Other SO Claim", status: "IN_REVIEW",
        productName: "P", reviewerId: 99,
        submittedAt: "2026-04-01T00:00:00Z",
      },
      {
        id: 2, title: "My Claim", status: "IN_REVIEW",
        productName: "P", reviewerId: 1,
        submittedAt: "2026-04-02T00:00:00Z",
      },
    ];
    renderQueue();
    const user = userEvent.setup();

    await screen.findByText("Other SO Claim");
    await user.click(screen.getByRole("switch", { name: /Mine only/i }));
    await waitFor(() => {
      expect(screen.queryByText("Other SO Claim")).not.toBeInTheDocument();
      expect(screen.getByText("My Claim")).toBeInTheDocument();
    });
  });

  it("kebab on Submitted row fires Start review and navigates to detail", async () => {
    state.rows = [
      {
        id: 7, title: "Pickable", status: "SUBMITTED",
        productName: "P", reviewerId: null,
        submittedAt: "2026-04-01T00:00:00Z",
      },
    ];
    renderQueue();
    const user = userEvent.setup();

    await screen.findByText("Pickable");
    await user.click(screen.getByRole("button", { name: /Row actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Start review/i }));

    await waitFor(() => {
      expect(state.starts).toContain(7);
    });
    expect(await screen.findByTestId("review-detail-stub")).toBeInTheDocument();
  });

  it("renders the Day-1 empty state when the queue is empty", async () => {
    renderQueue();
    await screen.findByText(/No requests in the queue yet/i);
  });
});
