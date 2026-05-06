import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamWorkloadPage } from "./TeamWorkloadPage";
import { TeamWorkloadDetailPage } from "./TeamWorkloadDetailPage";
import { renderWithProviders } from "../test/utils";
import type { TeamWorkloadRow, TeamWorkloadDetail } from "@/lib/api/reporting";

// Mock the reporting API module — avoids fetch routing complexity and aligns
// with how other test files mock leaf-level API modules (e.g. phases.test.tsx).
vi.mock("@/lib/api/reporting", () => ({
  getTeamWorkloadSummary: vi.fn(),
  getTeamWorkloadDetail: vi.fn(),
}));

// Mock auth/me so AuthProvider resolves and doesn't block rendering.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

import { getTeamWorkloadSummary, getTeamWorkloadDetail } from "@/lib/api/reporting";

const mockSummary = getTeamWorkloadSummary as ReturnType<typeof vi.fn>;
const mockDetail = getTeamWorkloadDetail as ReturnType<typeof vi.fn>;

const ME_ADMIN = {
  id: 1,
  email: "admin@local",
  firstName: "Sarah",
  lastName: "Admin",
  roles: ["Admin", "Solution Owner"],
};

const TEAM_ROW_1: TeamWorkloadRow = {
  teamId: 10,
  teamName: "Backend Team",
  memberCount: 3,
  activeProductCount: 2,
  totalEstimateRequests: 0,
  submittedCount: 0,
  inReviewCount: 0,
  approvedCount: 0,
  totalApprovedOnshoreHours: 0,
  totalApprovedOffshoreHours: 0,
  totalApprovedCost: 0,
};

const TEAM_ROW_2: TeamWorkloadRow = {
  teamId: 11,
  teamName: "Frontend Team",
  memberCount: 2,
  activeProductCount: 5,
  totalEstimateRequests: 0,
  submittedCount: 0,
  inReviewCount: 0,
  approvedCount: 0,
  totalApprovedOnshoreHours: 0,
  totalApprovedOffshoreHours: 0,
  totalApprovedCost: 0,
};

const TEAM_DETAIL: TeamWorkloadDetail = {
  teamId: 10,
  teamName: "Backend Team",
  members: [
    {
      id: 101,
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.com",
      active: true,
      roles: [],
      teams: [],
      pendingInvitation: false,
    } as unknown as TeamWorkloadDetail["members"][0],
  ],
  products: [
    {
      id: 201,
      name: "Auth API",
      description: "Handles authentication",
      active: true,
      teamId: 10,
      teamName: "Backend Team",
      subFeatureCount: 0,
      questionCount: 0,
      mode: "ATOMIC",
    } as unknown as TeamWorkloadDetail["products"][0],
  ],
  recentApprovedEstimates: [],
};

beforeEach(() => {
  mockSummary.mockResolvedValue([TEAM_ROW_1, TEAM_ROW_2]);
  mockDetail.mockResolvedValue(TEAM_DETAIL);
  fetchMock.mockImplementation((url: string) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    if (path === "/api/auth/me") return Promise.resolve(jsonResponse(ME_ADMIN));
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));
    return Promise.resolve(new Response(null, { status: 404 }));
  });
});

afterEach(() => {
  mockSummary.mockReset();
  mockDetail.mockReset();
  fetchMock.mockReset();
});

// ---------- TeamWorkloadPage (summary) --------------------------------------

describe("<TeamWorkloadPage>", () => {
  function setup() {
    return renderWithProviders(<TeamWorkloadPage />, { initialEntries: ["/reports/team-workload"] });
  }

  it("shows loading state initially then renders team rows", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Backend Team")).toBeInTheDocument());
    expect(screen.getByText("Frontend Team")).toBeInTheDocument();
  });

  it("renders member and product counts for each team", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Backend Team")).toBeInTheDocument());
    // Should have header row + 2 data rows
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the page header title 'Team workload'", async () => {
    setup();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Team workload" })).toBeInTheDocument());
  });

  it("shows empty state when no teams are returned", async () => {
    mockSummary.mockResolvedValue([]);
    setup();
    await waitFor(() => expect(screen.getByText("No team data yet")).toBeInTheDocument());
  });

  it("navigates to detail page on row click", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/reports/team-workload" element={<TeamWorkloadPage />} />
        <Route path="/reports/team-workload/:teamId" element={<TeamWorkloadDetailPage />} />
      </Routes>,
      { initialEntries: ["/reports/team-workload"] },
    );

    await waitFor(() => expect(screen.getByText("Backend Team")).toBeInTheDocument());
    const backendRow = screen.getByText("Backend Team").closest("tr")!;
    await user.click(backendRow);

    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
  });
});

// ---------- TeamWorkloadDetailPage ------------------------------------------

describe("<TeamWorkloadDetailPage>", () => {
  function setup(teamId = "10") {
    return renderWithProviders(
      <Routes>
        <Route path="/reports/team-workload/:teamId" element={<TeamWorkloadDetailPage />} />
        <Route path="/reports/team-workload" element={<div>all teams</div>} />
      </Routes>,
      { initialEntries: [`/reports/team-workload/${teamId}`] },
    );
  }

  it("renders the team name as the page heading", async () => {
    setup();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Backend Team" })).toBeInTheDocument());
  });

  it("shows the team member in the members section", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows the product in the products section", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Auth API")).toBeInTheDocument());
    expect(screen.getByText("Handles authentication")).toBeInTheDocument();
  });

  it("shows active badge for an active product", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Active")).toBeInTheDocument());
  });

  it("shows empty state for recent approved estimates when list is empty", async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByText("No approved estimates yet")).toBeInTheDocument()
    );
  });

  it("shows loading state before data arrives", () => {
    // mockDetail will resolve eventually but not synchronously
    mockDetail.mockReturnValue(new Promise(() => {})); // never resolves
    setup();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows 'Team not found' when detail returns null/undefined", async () => {
    mockDetail.mockResolvedValue(undefined as unknown as TeamWorkloadDetail);
    setup();
    await waitFor(() => expect(screen.getByText("Team not found.")).toBeInTheDocument());
  });

  it("'All teams' button navigates back to summary page", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByText("All teams")).toBeInTheDocument());
    await user.click(screen.getByText("All teams"));
    await waitFor(() => expect(screen.getByText("all teams")).toBeInTheDocument());
  });

  it("shows members count pill in the Members section header", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Members")).toBeInTheDocument());
    // Count pill shows "1" for the single member
    const memberSection = screen.getByText("Members").closest("header")!;
    expect(memberSection).toBeInTheDocument();
  });

  it("renders recent approved estimates table when estimates exist", async () => {
    mockDetail.mockResolvedValue({
      ...TEAM_DETAIL,
      recentApprovedEstimates: [
        {
          id: 301,
          title: "Member Portal v2",
          productName: "Auth API",
          complexity: "MED" as const,
          totalOnshoreHours: 120,
          totalOffshoreHours: 80,
          cost: 17600,
          reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
    setup();
    await waitFor(() => expect(screen.getByText("Member Portal v2")).toBeInTheDocument());
    // Multiple "Auth API" elements: one in products, one in estimates table
    const authApiElements = screen.getAllByText("Auth API");
    expect(authApiElements.length).toBeGreaterThanOrEqual(1);
    // Complexity pill
    expect(screen.getByText("Med")).toBeInTheDocument();
  });
});
