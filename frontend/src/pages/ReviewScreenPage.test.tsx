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
  isReviewable: boolean;
  rejectionReason: string | null;
  revisionCount: number;
  originalProductId: null;
  originalProductName: null;
}

interface MockState {
  detail: MockDetail | null;
  meRoles: string[];
  itemStarts: { requestId: number; itemId: number }[];
  itemApprovals: { requestId: number; itemId: number; body: any }[];
  itemRejections: { requestId: number; itemId: number; body: any }[];
  itemTakeOvers: { requestId: number; itemId: number }[];
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
    requesterId: 99,
    derivedStatus: d.status,
    createdAt: "2026-04-10T00:00:00Z",
    updatedAt: "2026-04-15T00:00:00Z",
    items: [
      {
        id: 1,
        productId: 1,
        productName: "Member Portal",
        subFeatureId: null,
        subFeatureName: null,
        teamName: null,
        templateId: 5,
        templateVersionNumber: 2,
        status: d.status,
        complexity: d.complexity,
        reviewerId: d.reviewerId,
        reviewerName: d.reviewerName,
        reviewerStatus: d.reviewerStatus,
        justification: d.justification,
        submittedAt: "2026-04-15T00:00:00Z",
        reviewedAt: d.reviewedAt,
        approvedBlendedRateId: d.approvedBlendedRateId,
        displayOrder: 0,
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
          { questionId: 100, questionText: "How many users?", required: true, answerText: "50000", attachments: [] },
        ],
        clarificationNote: null,
        clarificationResponse: null,
        isReviewable: d.isReviewable,
        rejectionReason: d.rejectionReason,
        revisionCount: d.revisionCount,
        originalProductId: d.originalProductId,
        originalProductName: d.originalProductName,
      },
    ],
  };
}

function installRouter() {
  state = {
    detail: null,
    meRoles: ["Solution Owner"],
    itemStarts: [],
    itemApprovals: [],
    itemRejections: [],
    itemTakeOvers: [],
  };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: currentSoId, email: "so1@local", firstName: "SO", lastName: "One",
        roles: state.meRoles,
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

    // Per-item start: POST /api/estimates/review/{requestId}/items/{itemId}/start
    const itemStartMatch = path.match(/^\/api\/estimates\/review\/(\d+)\/items\/(\d+)\/start$/);
    if (itemStartMatch && method === "POST") {
      const requestId = Number(itemStartMatch[1]);
      const itemId = Number(itemStartMatch[2]);
      state.itemStarts.push({ requestId, itemId });
      if (state.detail) {
        state.detail.status = "IN_REVIEW";
        state.detail.reviewerId = currentSoId;
        state.detail.reviewerName = "SO One";
        state.detail.reviewerStatus = "you";
      }
      return Promise.resolve(jsonResponse(fullDetail(state.detail!)));
    }

    // Admin take-over: POST /api/estimates/admin/{requestId}/items/{itemId}/take-over
    const itemTakeOverMatch = path.match(/^\/api\/estimates\/admin\/(\d+)\/items\/(\d+)\/take-over$/);
    if (itemTakeOverMatch && method === "POST") {
      state.itemTakeOvers.push({
        requestId: Number(itemTakeOverMatch[1]),
        itemId: Number(itemTakeOverMatch[2]),
      });
      if (state.detail) {
        state.detail.reviewerId = currentSoId;
        state.detail.reviewerName = "SO One";
        state.detail.reviewerStatus = "you";
      }
      return Promise.resolve(jsonResponse(fullDetail(state.detail!)));
    }

    // Per-item approve: POST /api/estimates/review/{requestId}/items/{itemId}/approve
    const itemApproveMatch = path.match(/^\/api\/estimates\/review\/(\d+)\/items\/(\d+)\/approve$/);
    if (itemApproveMatch && method === "POST") {
      const requestId = Number(itemApproveMatch[1]);
      const itemId = Number(itemApproveMatch[2]);
      const body = JSON.parse(init?.body as string);
      state.itemApprovals.push({ requestId, itemId, body });
      if (state.detail) {
        state.detail.status = "APPROVED";
        state.detail.reviewedAt = new Date().toISOString();
        state.detail.approvedBlendedRateId = 1;
        state.detail.complexity = body.complexity;
      }
      return Promise.resolve(jsonResponse(fullDetail(state.detail!)));
    }

    // Per-item reject: POST /api/estimates/review/{requestId}/items/{itemId}/reject
    const itemRejectMatch = path.match(/^\/api\/estimates\/review\/(\d+)\/items\/(\d+)\/reject$/);
    if (itemRejectMatch && method === "POST") {
      const requestId = Number(itemRejectMatch[1]);
      const itemId = Number(itemRejectMatch[2]);
      const body = JSON.parse(init?.body as string);
      state.itemRejections.push({ requestId, itemId, body });
      if (state.detail) {
        state.detail.status = "REJECTED";
        state.detail.rejectionReason = body.rejectionReason;
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
      isReviewable: true, rejectionReason: null, revisionCount: 0,
      originalProductId: null, originalProductName: null,
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
      isReviewable: true, rejectionReason: null, revisionCount: 0,
      originalProductId: null, originalProductName: null,
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
      isReviewable: true, rejectionReason: null, revisionCount: 0,
      originalProductId: null, originalProductName: null,
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

  it("Approve flow: confirmation modal + POST + stays on page showing approved state", async () => {
    state.detail = {
      id: 4, title: "About to Approve", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: "MED", justification: "Approved.", approvedBlendedRateId: null, reviewedAt: null,
      isReviewable: true, rejectionReason: null, revisionCount: 0,
      originalProductId: null, originalProductName: null,
    };
    renderAt("4");

    const user = userEvent.setup();
    await screen.findByRole("radiogroup", { name: /Complexity/i });

    await user.click(screen.getByRole("button", { name: /^Approve$/ }));
    // ConfirmModal uses role="alertdialog"
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Approve this estimate\?/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^Approve$/ }));

    await waitFor(() => {
      expect(state.itemApprovals).toHaveLength(1);
      expect(state.itemApprovals[0].requestId).toBe(4);
      expect(state.itemApprovals[0].itemId).toBe(1);
      expect(state.itemApprovals[0].body.complexity).toBe("MED");
      expect(state.itemApprovals[0].body).toHaveProperty("lineOverrides");
    });
    // Page stays — no navigation to queue, item flips to approved terminal state.
    expect(screen.queryByTestId("queue-stub")).not.toBeInTheDocument();
    expect(await screen.findByText(/Approved by SO One/i)).toBeInTheDocument();
  });

  it("Reject flow: modal with justification field, POST + navigate", async () => {
    state.detail = {
      id: 5, title: "Reject Me", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: "LOW", justification: "Pre-fill text", approvedBlendedRateId: null, reviewedAt: null,
      isReviewable: true, rejectionReason: null, revisionCount: 0,
      originalProductId: null, originalProductName: null,
    };
    renderAt("5");

    const user = userEvent.setup();
    await screen.findByRole("radiogroup", { name: /Complexity/i });

    await user.click(screen.getByRole("button", { name: /^Reject$/ }));
    const dialog = await screen.findByRole("alertdialog");
    // Rejection reason textarea pre-filled with current justification.
    const reasonField = within(dialog).getByRole("textbox", { name: /Rejection reason/i });
    expect(reasonField).toHaveValue("Pre-fill text");

    // Confirm rejection.
    await user.click(within(dialog).getByRole("button", { name: /^Reject$/ }));
    await waitFor(() => {
      expect(state.itemRejections).toHaveLength(1);
      expect(state.itemRejections[0].requestId).toBe(5);
      expect(state.itemRejections[0].itemId).toBe(1);
      expect(state.itemRejections[0].body.rejectionReason).toBe("Pre-fill text");
    });
  });

  it("Cell override updates row value and grand total live", async () => {
    state.detail = {
      id: 6, title: "Override Math", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: "MED", justification: "Reviewing", approvedBlendedRateId: null, reviewedAt: null,
      isReviewable: true, rejectionReason: null, revisionCount: 0,
      originalProductId: null, originalProductName: null,
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
      isReviewable: false, rejectionReason: null, revisionCount: 0,
      originalProductId: null, originalProductName: null,
    };
    renderAt("7");

    // Banner is "<strong>SO Two</strong> is reviewing this request..."
    const matches = await screen.findAllByText(/is reviewing this request/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText("SO Two")).toBeInTheDocument();
    // Complexity radios are disabled for non-reviewers.
    const medRadio = screen.getByRole("radio", { name: /Medium/i });
    expect(medRadio).toBeDisabled();
    // Approve disabled.
    expect(screen.getByRole("button", { name: /^Approve$/ })).toBeDisabled();
  });

  it("Admin can take over another SO's claim from the claimed banner", async () => {
    state.meRoles = ["Admin"];
    state.detail = {
      id: 7, title: "Other SO's Claim", status: "IN_REVIEW",
      reviewerId: 99, reviewerName: "SO Two", reviewerStatus: "other-so",
      complexity: "MED", justification: "Their reasoning", approvedBlendedRateId: null, reviewedAt: null,
      isReviewable: false, rejectionReason: null, revisionCount: 0,
      originalProductId: null, originalProductName: null,
    };
    renderAt("7");

    // Non-admins (previous test) get no button; admins do.
    const takeOverBtn = await screen.findByRole("button", { name: /Take over review/i });
    await userEvent.click(takeOverBtn);

    // Confirm modal explains state is preserved, then fires the POST.
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/in-progress work/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Take over review/i }));

    await waitFor(() => {
      expect(state.itemTakeOvers).toEqual([{ requestId: 7, itemId: 1 }]);
    });
  });

  it("complexity change is local — no PUT fired before approve", async () => {
    state.detail = {
      id: 8, title: "No Autosave", status: "IN_REVIEW",
      reviewerId: 1, reviewerName: "SO One", reviewerStatus: "you",
      complexity: null, justification: null, approvedBlendedRateId: null, reviewedAt: null,
      isReviewable: true, rejectionReason: null, revisionCount: 0,
      originalProductId: null, originalProductName: null,
    };
    renderAt("8");

    const user = userEvent.setup();
    await screen.findByRole("radiogroup", { name: /Complexity/i });

    // Click a complexity radio.
    await user.click(screen.getByRole("radio", { name: /High/i }));

    // Wait 200ms — no PUT /state should have been fired.
    await new Promise((r) => setTimeout(r, 200));

    // Verify no PUT to /state was made.
    const putCalls = fetchMock.mock.calls.filter(
      (args: any[]) =>
        String(args[0]).includes("/state") && ((args[1]?.method ?? "GET") as string).toUpperCase() === "PUT",
    );
    expect(putCalls).toHaveLength(0);

    // Also verify no item-level endpoints were called yet (no approve, no reject).
    expect(state.itemApprovals).toHaveLength(0);
    expect(state.itemRejections).toHaveLength(0);
  });
});
