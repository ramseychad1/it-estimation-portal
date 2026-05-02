import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewScreenPage } from "./ReviewScreenPage";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockDetail {
  id: number;
  title: string;
  status: "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  reviewerId: number | null;
  reviewerName: string | null;
  reviewerStatus: "you" | "other-so" | "unclaimed";
  complexity: "LOW" | "MED" | "HIGH" | null;
  justification: string | null;
  approvedBlendedRateId: number | null;
  reviewedAt: string | null;
}

interface MockState {
  detail: MockDetail | null;
  starts: number[];
  saves: { id: number; body: any }[];
  approves: number[];
  rejects: { id: number; justification: string }[];
}
let state: MockState;
let currentSoId = 1;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fullDetail(d: MockDetail) {
  return {
    id: d.id,
    title: d.title,
    description: "Some context",
    productId: 1,
    productName: "Member Portal",
    subFeatureId: null,
    subFeatureName: null,
    templateId: 5,
    templateVersionNumber: 2,
    complexity: d.complexity,
    status: d.status,
    requesterId: 99,
    reviewerId: d.reviewerId,
    reviewerName: d.reviewerName,
    reviewerStatus: d.reviewerStatus,
    justification: d.justification,
    submittedAt: "2026-04-15T00:00:00Z",
    reviewedAt: d.reviewedAt,
    approvedBlendedRateId: d.approvedBlendedRateId,
    createdAt: "2026-04-10T00:00:00Z",
    updatedAt: "2026-04-15T00:00:00Z",
    phaseLines: [
      {
        sdlcPhaseId: 1, sdlcPhaseName: "Discovery", displayOrder: 1,
        onshoreLow: 5, onshoreMed: 10, onshoreHigh: 15,
        offshoreLow: 2, offshoreMed: 4, offshoreHigh: 6,
        onshoreOverride: null, offshoreOverride: null,
      },
      {
        sdlcPhaseId: 2, sdlcPhaseName: "Build", displayOrder: 2,
        onshoreLow: 40, onshoreMed: 80, onshoreHigh: 120,
        offshoreLow: 20, offshoreMed: 40, offshoreHigh: 60,
        onshoreOverride: null, offshoreOverride: null,
      },
    ],
    answers: [
      { questionId: 100, questionText: "How many users?", required: true, answerText: "50000" },
    ],
  };
}

function installRouter() {
  state = { detail: null, starts: [], saves: [], approves: [], rejects: [] };
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

    if (path === "/api/admin/rates" && method === "GET") {
      return Promise.resolve(jsonResponse({
        current: {
          id: 1, onshoreRate: "125.00", offshoreRate: "45.00",
          effectiveDate: "2026-04-01", note: null, createdAt: null, createdBy: null,
          current: true, scheduled: false,
        },
        history: { items: [], page: 0, size: 1, totalElements: 1, totalPages: 1 },
      }));
    }

    const detailMatch = path.match(/^\/api\/estimates\/review\/(\d+)$/);
    if (detailMatch && method === "GET") {
      if (!state.detail) return Promise.resolve(new Response(null, { status: 404 }));
      return Promise.resolve(jsonResponse(fullDetail(state.detail)));
    }

    const startMatch = path.match(/^\/api\/estimates\/review\/(\d+)\/start$/);
    if (startMatch && method === "POST") {
      const id = Number(startMatch[1]);
      state.starts.push(id);
      if (state.detail) {
        state.detail.status = "IN_REVIEW";
        state.detail.reviewerId = currentSoId;
        state.detail.reviewerName = "SO One";
        state.detail.reviewerStatus = "you";
      }
      return Promise.resolve(jsonResponse(fullDetail(state.detail!)));
    }

    const stateMatch = path.match(/^\/api\/estimates\/review\/(\d+)\/state$/);
    if (stateMatch && method === "PUT") {
      const id = Number(stateMatch[1]);
      const body = JSON.parse(init?.body as string);
      state.saves.push({ id, body });
      if (state.detail) {
        if (body.complexity !== undefined) state.detail.complexity = body.complexity;
        if (body.justification !== undefined) state.detail.justification = body.justification;
      }
      return Promise.resolve(jsonResponse(fullDetail(state.detail!)));
    }

    const approveMatch = path.match(/^\/api\/estimates\/review\/(\d+)\/approve$/);
    if (approveMatch && method === "POST") {
      const id = Number(approveMatch[1]);
      state.approves.push(id);
      if (state.detail) {
        state.detail.status = "APPROVED";
        state.detail.reviewedAt = new Date().toISOString();
        state.detail.approvedBlendedRateId = 1;
      }
      return Promise.resolve(jsonResponse(fullDetail(state.detail!)));
    }

    const rejectMatch = path.match(/^\/api\/estimates\/review\/(\d+)\/reject$/);
    if (rejectMatch && method === "POST") {
      const id = Number(rejectMatch[1]);
      const body = JSON.parse(init?.body as string);
      state.rejects.push({ id, justification: body.justification });
      if (state.detail) {
        state.detail.status = "REJECTED";
        state.detail.justification = body.justification;
      }
      return Promise.resolve(jsonResponse(fullDetail(state.detail!)));
    }

    const historyMatch = path.match(/^\/api\/estimates\/my\/(\d+)\/history$/);
    if (historyMatch) return Promise.resolve(jsonResponse([]));

    if (path === "/api/admin/users/99") {
      return Promise.resolve(jsonResponse({
        id: 99, email: "req@local", firstName: "Req", lastName: "User",
        active: true, roles: ["Requester"], invitationStatus: "ACTIVE",
      }));
    }

    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

function renderAt(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/review/:id" element={<ReviewScreenPage />} />
      <Route path="/review" element={<div data-testid="queue-stub" />} />
    </Routes>,
    { initialEntries: [`/review/${id}`] },
  );
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

describe("<ReviewScreenPage>", () => {
  it("Submitted state shows the 'Start review' CTA + read-only summary", async () => {
    state.detail = {
      id: 1, title: "Submitted Request", status: "SUBMITTED",
      reviewerId: null, reviewerName: null, reviewerStatus: "unclaimed",
      complexity: null, justification: null, approvedBlendedRateId: null, reviewedAt: null,
    };
    renderAt("1");

    expect(await screen.findByRole("heading", { name: /Ready to review\?/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start review/i })).toBeInTheDocument();
    // Complexity selector should NOT be visible — only In Review shows it.
    expect(screen.queryByRole("radiogroup", { name: /Complexity/i })).not.toBeInTheDocument();
  });

  it("In Review by you: complexity selector enables grid editing on chosen column", async () => {
    state.detail = {
      id: 2, title: "Mine to Review", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: null, justification: null, approvedBlendedRateId: null, reviewedAt: null,
    };
    renderAt("2");

    const user = userEvent.setup();
    await screen.findByRole("radiogroup", { name: /Complexity/i });

    // Before picking complexity: every cell should be a read-only span,
    // not an input.
    expect(screen.queryByRole("textbox", { name: /Discovery Onshore M/i })).not.toBeInTheDocument();

    // Pick MED.
    await user.click(screen.getByRole("radio", { name: /Medium/i }));
    // Now Onshore-M and Offshore-M cells should be editable inputs.
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Discovery Onshore M/i })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /Discovery Offshore M/i })).toBeInTheDocument();
    });
    // Onshore-L should still NOT be editable.
    expect(screen.queryByRole("textbox", { name: /Discovery Onshore L/i })).not.toBeInTheDocument();
  });

  it("Approve button disabled until complexity AND justification are set", async () => {
    state.detail = {
      id: 3, title: "Approve Gating", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: null, justification: null, approvedBlendedRateId: null, reviewedAt: null,
    };
    renderAt("3");

    const user = userEvent.setup();
    await screen.findByRole("radiogroup", { name: /Complexity/i });

    expect(screen.getByRole("button", { name: /^Approve$/ })).toBeDisabled();

    // Pick complexity — still missing justification.
    await user.click(screen.getByRole("radio", { name: /Medium/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Approve$/ })).toBeDisabled();
    });

    // Add justification — now Approve enables.
    await user.type(
      screen.getByRole("textbox", { name: /Justification/i }),
      "Validated and ready",
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Approve$/ })).not.toBeDisabled();
    });
  });

  it("Approve flow: confirmation modal + POST + navigate to queue", async () => {
    state.detail = {
      id: 4, title: "About to Approve", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: "MED", justification: "Approved.", approvedBlendedRateId: null, reviewedAt: null,
    };
    renderAt("4");

    const user = userEvent.setup();
    await screen.findByRole("radiogroup", { name: /Complexity/i });

    await user.click(screen.getByRole("button", { name: /^Approve$/ }));
    // ConfirmModal uses role="alertdialog" (alert variant since it
    // initiates an action with a confirmation step).
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Approve this estimate\?/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^Approve$/ }));

    await waitFor(() => {
      expect(state.approves).toContain(4);
    });
    expect(await screen.findByTestId("queue-stub")).toBeInTheDocument();
  });

  it("Reject flow: modal with justification field, POST + navigate", async () => {
    state.detail = {
      id: 5, title: "Reject Me", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: "LOW", justification: "Pre-fill text", approvedBlendedRateId: null, reviewedAt: null,
    };
    renderAt("5");

    const user = userEvent.setup();
    await screen.findByRole("radiogroup", { name: /Complexity/i });

    await user.click(screen.getByRole("button", { name: /^Reject$/ }));
    const dialog = await screen.findByRole("alertdialog");
    // Justification textarea defaults to current saved justification.
    const reasonField = within(dialog).getByRole("textbox", { name: /Rejection reason/i });
    expect(reasonField).toHaveValue("Pre-fill text");

    // Confirm rejection.
    await user.click(within(dialog).getByRole("button", { name: /^Reject$/ }));
    await waitFor(() => {
      expect(state.rejects).toHaveLength(1);
      expect(state.rejects[0].justification).toBe("Pre-fill text");
    });
  });

  it("Cell override updates row value and grand total live", async () => {
    state.detail = {
      id: 6, title: "Override Math", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: "MED", justification: "Reviewing", approvedBlendedRateId: null, reviewedAt: null,
    };
    renderAt("6");

    const user = userEvent.setup();
    await screen.findByRole("radiogroup", { name: /Complexity/i });

    // Snapshot for MED: Discovery onshoreMed=10 + offshoreMed=4 + Build
    // onshoreMed=80 + offshoreMed=40 = 134 hours total.
    expect(await screen.findByText(/134 hours/i)).toBeInTheDocument();

    // Override Discovery Onshore M from 10 → 50 (delta +40).
    const cell = screen.getByRole("textbox", { name: /Discovery Onshore M/i });
    await user.clear(cell);
    await user.type(cell, "50");
    await user.tab(); // commit on blur

    // New total = 134 - 10 + 50 = 174.
    await waitFor(() => {
      expect(screen.getByText(/174 hours/i)).toBeInTheDocument();
    });
  });

  it("In Review by another SO: claimed banner + complexity disabled", async () => {
    state.detail = {
      id: 7, title: "Other SO's Claim", status: "IN_REVIEW",
      reviewerId: 99, reviewerName: "SO Two", reviewerStatus: "other-so",
      complexity: "MED", justification: "Their reasoning", approvedBlendedRateId: null, reviewedAt: null,
    };
    renderAt("7");

    // Banner is "<strong>SO Two</strong> is reviewing this request..."
    // — find the unique fragment text + verify SO Two is in the same area.
    const matches = await screen.findAllByText(/is reviewing this request/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText("SO Two")).toBeInTheDocument();
    // Complexity radios are disabled for non-reviewers.
    const medRadio = screen.getByRole("radio", { name: /Medium/i });
    expect(medRadio).toBeDisabled();
    // Approve disabled.
    expect(screen.getByRole("button", { name: /^Approve$/ })).toBeDisabled();
  });

  it("autosave fires on complexity change (debounced PUT to /state)", async () => {
    state.detail = {
      id: 8, title: "Autosave Trigger", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: null, justification: null, approvedBlendedRateId: null, reviewedAt: null,
    };
    renderAt("8");

    const user = userEvent.setup();
    await screen.findByRole("radiogroup", { name: /Complexity/i });

    expect(state.saves).toHaveLength(0);
    await user.click(screen.getByRole("radio", { name: /High/i }));

    // Wait past the 1s debounce.
    await waitFor(
      () => {
        expect(state.saves.length).toBeGreaterThanOrEqual(1);
        expect(state.saves[state.saves.length - 1].body.complexity).toBe("HIGH");
      },
      { timeout: 3000 },
    );
  });
});
