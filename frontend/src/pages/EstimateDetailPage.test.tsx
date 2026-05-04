import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EstimateDetailPage } from "./EstimateDetailPage";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockDetail {
  id: number;
  title: string;
  description: string | null;
  productName: string;
  subFeatureName: string | null;
  templateId: number | null;
  templateVersionNumber: number | null;
  /** Used as both request derivedStatus and the single item's status (unless overridden). */
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_REVISION";
  requesterId: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Phase 6b extensions — drive the Approved + Rejected views.
  complexity?: "LOW" | "MED" | "HIGH" | null;
  justification?: string | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  approvedBlendedRateId?: number | null;
  // Phase 9b: per-item rejection fields.
  rejectionReason?: string | null;
  phaseLines: Array<{
    sdlcPhaseId: number;
    sdlcPhaseName: string;
    displayOrder: number;
    onshoreLow: number;
    onshoreMed: number;
    onshoreHigh: number;
    offshoreLow: number;
    offshoreMed: number;
    offshoreHigh: number;
    onshoreOverride: number | null;
    offshoreOverride: number | null;
  }>;
  answers: Array<{
    questionId: number;
    questionText: string;
    required: boolean;
    answerText: string;
  }>;
}

interface MockHistoryEntry {
  id: number;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: number | null;
  changedAt: string;
  notes: string | null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function detailResponse(d: MockDetail) {
  // NEEDS_REVISION: request-level status is NEEDS_REVISION, item-level is REJECTED.
  const itemStatus = d.status === "NEEDS_REVISION" ? "REJECTED" : d.status;
  return jsonResponse({
    id: d.id,
    title: d.title,
    description: d.description,
    requesterId: d.requesterId,
    derivedStatus: d.status,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    items: [
      {
        id: 1,
        productId: 1,
        productName: d.productName,
        subFeatureId: d.subFeatureName ? 1 : null,
        subFeatureName: d.subFeatureName,
        teamName: null,
        templateId: d.templateId,
        templateVersionNumber: d.templateVersionNumber,
        status: itemStatus,
        complexity: d.complexity ?? null,
        reviewerId: d.reviewerName ? 50 : null,
        reviewerName: d.reviewerName ?? null,
        reviewerStatus: d.reviewerName ? "other-so" : "unclaimed",
        justification: d.justification ?? null,
        rejectionReason: d.rejectionReason ?? null,
        revisionCount: 0,
        originalProductId: null,
        originalProductName: null,
        isReviewable: false,
        submittedAt: d.submittedAt,
        reviewedAt: d.reviewedAt ?? null,
        approvedBlendedRateId: d.approvedBlendedRateId ?? null,
        displayOrder: 0,
        phaseLines: d.phaseLines,
        answers: d.answers,
      },
    ],
  });
}

let detail: MockDetail | null;
let history: MockHistoryEntry[];

// Mutable handlers for Phase 9b per-item mutations.
let reviseHandler: ((url: string, init: RequestInit | undefined) => Response) | null = null;
let dropHandler: ((url: string, init: RequestInit | undefined) => Response) | null = null;

function installRouter() {
  detail = null;
  history = [];
  reviseHandler = null;
  dropHandler = null;
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

    if (path === "/api/admin/rates") {
      return Promise.resolve(jsonResponse({
        current: {
          id: 1, onshoreRate: "125.00", offshoreRate: "45.00",
          effectiveDate: "2026-04-01", note: null, createdAt: null, createdBy: null,
          current: true, scheduled: false,
        },
        history: { items: [], page: 0, size: 1, totalElements: 1, totalPages: 1 },
      }));
    }

    // Products — needed when NEEDS_REVISION renders the ProductPickerModal.
    if (path === "/api/catalog/products" && method === "GET") {
      return Promise.resolve(jsonResponse({
        items: [], page: 0, size: 200, totalElements: 0, totalPages: 0,
      }));
    }

    const detailMatch = path.match(/^\/api\/estimates\/my\/(\d+)$/);
    if (detailMatch && method === "GET") {
      if (!detail) return Promise.resolve(new Response(null, { status: 404 }));
      return Promise.resolve(detailResponse(detail));
    }

    const reviseMatch = path.match(/^\/api\/estimates\/my\/(\d+)\/items\/(\d+)\/revise-and-resubmit$/);
    if (reviseMatch && method === "POST") {
      if (reviseHandler) return Promise.resolve(reviseHandler(url, init));
      return Promise.resolve(new Response(null, { status: 404 }));
    }

    const dropMatch = path.match(/^\/api\/estimates\/my\/(\d+)\/items\/(\d+)$/);
    if (dropMatch && method === "DELETE") {
      if (dropHandler) return Promise.resolve(dropHandler(url, init));
      return Promise.resolve(new Response(null, { status: 404 }));
    }

    const historyMatch = path.match(/^\/api\/estimates\/my\/(\d+)\/history$/);
    if (historyMatch) {
      return Promise.resolve(jsonResponse(history));
    }
    if (path === "/api/admin/users/1") {
      return Promise.resolve(jsonResponse({
        id: 1, email: "test@local", firstName: "Test", lastName: "Requester",
        active: true, roles: ["Requester"], invitationStatus: "ACTIVE",
      }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

function renderAt(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/requests/:id" element={<EstimateDetailPage />} />
    </Routes>,
    { initialEntries: [`/requests/${id}`] },
  );
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

describe("<EstimateDetailPage>", () => {
  it("Draft renders an 'Edit answers' link in the questions card", async () => {
    detail = {
      id: 1,
      title: "My Draft",
      description: null,
      productName: "Member Portal",
      subFeatureName: null,
      templateId: null,
      templateVersionNumber: null,
      status: "DRAFT",
      requesterId: 1,
      submittedAt: null,
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
      phaseLines: [],
      answers: [
        { questionId: 1, questionText: "How many users?", required: true, answerText: "" },
      ],
    };

    renderAt("1");

    // Title appears in both the breadcrumb and the header — assert the
    // header H1 specifically.
    expect(await screen.findByRole("heading", { name: "My Draft", level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Edit answers/i })).toBeInTheDocument();
  });

  it("Submitted state renders the 'awaiting review' banner and the snapshot table", async () => {
    detail = {
      id: 2,
      title: "Submitted Request",
      description: "Some context",
      productName: "Member Portal",
      subFeatureName: null,
      templateId: 5,
      templateVersionNumber: 3,
      status: "SUBMITTED",
      requesterId: 1,
      submittedAt: "2026-04-15T00:00:00Z",
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-15T00:00:00Z",
      phaseLines: [
        {
          sdlcPhaseId: 1, sdlcPhaseName: "Discovery", displayOrder: 1,
          onshoreLow: 5, onshoreMed: 10, onshoreHigh: 15,
          offshoreLow: 2, offshoreMed: 4, offshoreHigh: 6,
          onshoreOverride: null, offshoreOverride: null,
        },
      ],
      answers: [],
    };

    renderAt("2");

    expect(await screen.findByRole("heading", { name: "Submitted Request", level: 1 })).toBeInTheDocument();
    expect(
      await screen.findByText(/awaiting review/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    // Edit answers link should NOT appear on Submitted.
    expect(screen.queryByRole("button", { name: /Edit answers/i })).not.toBeInTheDocument();
  });

  it("Activity card shows entries from change_log history", async () => {
    detail = {
      id: 3,
      title: "Audited",
      description: null,
      productName: "P",
      subFeatureName: null,
      templateId: null,
      templateVersionNumber: null,
      status: "DRAFT",
      requesterId: 1,
      submittedAt: null,
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
      phaseLines: [],
      answers: [],
    };
    history = [
      {
        id: 100, action: "CREATED", fieldName: null, oldValue: null, newValue: null,
        changedBy: 1, changedAt: "2026-04-01T00:00:00Z", notes: null,
      },
      {
        id: 101, action: "UPDATED", fieldName: "title", oldValue: "Old", newValue: "Audited",
        changedBy: 1, changedAt: "2026-04-02T00:00:00Z", notes: null,
      },
    ];

    renderAt("3");

    expect(await screen.findByRole("heading", { name: "Audited", level: 1 })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Created")).toBeInTheDocument();
      expect(screen.getByText("Updated")).toBeInTheDocument();
    });
  });

  it("404 from the detail endpoint renders the privacy 'Request not found' panel", async () => {
    detail = null; // forces 404

    renderAt("999");

    await waitFor(() => {
      expect(screen.getByText(/Request not found/i)).toBeInTheDocument();
    });
    // Specifically does NOT say "access denied" — the 404 conflates
    // doesn't-exist with belongs-to-someone-else on purpose.
    expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forbidden/i)).not.toBeInTheDocument();
  });

  // ---- Phase 6b additions: Approved + Rejected populated views -----------

  it("Approved state renders complexity pill, approved banner, justification block, and total cost", async () => {
    detail = {
      id: 10,
      title: "Approved Request",
      description: "Validated context",
      productName: "Member Portal",
      subFeatureName: null,
      templateId: 5,
      templateVersionNumber: 3,
      status: "APPROVED",
      complexity: "MED",
      justification: "Validated answers; Medium complexity is correct here.",
      reviewerName: "SO Smith",
      reviewedAt: "2026-04-20T00:00:00Z",
      approvedBlendedRateId: 1,
      requesterId: 1,
      submittedAt: "2026-04-15T00:00:00Z",
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-20T00:00:00Z",
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
      answers: [],
    };

    renderAt("10");

    expect(await screen.findByRole("heading", { name: "Approved Request", level: 1 })).toBeInTheDocument();
    // Approved banner with reviewer name.
    expect(await screen.findByText(/Approved by/i)).toBeInTheDocument();
    expect(screen.getByText("SO Smith")).toBeInTheDocument();
    // Complexity pill prominently displayed.
    expect(screen.getByText("Medium")).toBeInTheDocument();
    // Justification under "Reviewer's justification" label.
    expect(screen.getByText(/Reviewer's justification/i)).toBeInTheDocument();
    expect(screen.getByText(/Validated answers; Medium complexity is correct here\./i)).toBeInTheDocument();
    // Grand total row: ONS Med (90) + OFF Med (44) = 134 hrs total.
    await waitFor(() => {
      expect(screen.getAllByText("134").length).toBeGreaterThan(0);
    });
    // Total cost: 90 onshore × $125 + 44 offshore × $45 = $11,250 + $1,980 = $13,230.
    // Appears in both the Grand Total row and the Estimate Total $ row.
    expect(screen.getAllByText(/\$13,230/i).length).toBeGreaterThan(0);
  });

  it("Rejected state renders rejection reason in a quoted block under Rejection reason label", async () => {
    detail = {
      id: 11,
      title: "Rejected Request",
      description: null,
      productName: "Member Portal",
      subFeatureName: null,
      templateId: 5,
      templateVersionNumber: 2,
      status: "REJECTED",
      complexity: null,
      justification: "Question 2 needs more detail before this can be approved.",
      reviewerName: "SO Brown",
      reviewedAt: "2026-04-22T00:00:00Z",
      approvedBlendedRateId: null,
      requesterId: 1,
      submittedAt: "2026-04-15T00:00:00Z",
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-22T00:00:00Z",
      phaseLines: [
        {
          sdlcPhaseId: 1, sdlcPhaseName: "Discovery", displayOrder: 1,
          onshoreLow: 5, onshoreMed: 10, onshoreHigh: 15,
          offshoreLow: 2, offshoreMed: 4, offshoreHigh: 6,
          onshoreOverride: null, offshoreOverride: null,
        },
      ],
      answers: [],
    };

    renderAt("11");

    expect(await screen.findByRole("heading", { name: "Rejected Request", level: 1 })).toBeInTheDocument();
    // Amber-tint rejection banner.
    expect(await screen.findByText(/Rejected by/i)).toBeInTheDocument();
    expect(screen.getByText("SO Brown")).toBeInTheDocument();
    // Quoted-style justification under "Rejection reason" label.
    expect(screen.getByText(/Rejection reason/i)).toBeInTheDocument();
    expect(screen.getByText(/Question 2 needs more detail/i)).toBeInTheDocument();
    // Cost section is approval-only — should NOT appear on Rejected.
    expect(screen.queryByText(/Estimated total/i)).not.toBeInTheDocument();
  });

  // ---- Phase 9b additions: NEEDS_REVISION per-item revision flow --------

  it("NEEDS_REVISION renders rejection banner with reason and 'Revise & resubmit' button", async () => {
    detail = {
      id: 20,
      title: "Needs Revision Request",
      description: null,
      productName: "Member Portal",
      subFeatureName: null,
      templateId: null,
      templateVersionNumber: null,
      status: "NEEDS_REVISION",
      rejectionReason: "Please provide more detail in question 1.",
      reviewerName: "SO Clark",
      reviewedAt: "2026-04-25T00:00:00Z",
      requesterId: 1,
      submittedAt: "2026-04-20T00:00:00Z",
      createdAt: "2026-04-18T00:00:00Z",
      updatedAt: "2026-04-25T00:00:00Z",
      phaseLines: [],
      answers: [
        { questionId: 1, questionText: "What is the scope?", required: true, answerText: "TBD" },
      ],
    };

    renderAt("20");

    expect(await screen.findByRole("heading", { name: "Needs Revision Request", level: 1 })).toBeInTheDocument();
    // Rejection banner.
    expect(await screen.findByText(/Rejected by/i)).toBeInTheDocument();
    expect(screen.getByText("SO Clark")).toBeInTheDocument();
    expect(screen.getByText(/Please provide more detail in question 1\./i)).toBeInTheDocument();
    // Action button.
    expect(screen.getByRole("button", { name: /Revise & resubmit/i })).toBeInTheDocument();
    // Answers listed.
    expect(screen.getByText("What is the scope?")).toBeInTheDocument();
    expect(screen.getByText("TBD")).toBeInTheDocument();
  });

  it("Revise & resubmit enters edit mode with editable textareas", async () => {
    detail = {
      id: 21,
      title: "Revision Edit Mode",
      description: null,
      productName: "Provider Portal",
      subFeatureName: null,
      templateId: null,
      templateVersionNumber: null,
      status: "NEEDS_REVISION",
      rejectionReason: "Answer is too vague.",
      reviewerName: "SO Davis",
      reviewedAt: "2026-04-26T00:00:00Z",
      requesterId: 1,
      submittedAt: "2026-04-22T00:00:00Z",
      createdAt: "2026-04-20T00:00:00Z",
      updatedAt: "2026-04-26T00:00:00Z",
      phaseLines: [],
      answers: [
        { questionId: 5, questionText: "Describe the business need.", required: true, answerText: "Need help." },
      ],
    };

    renderAt("21");
    const user = userEvent.setup();

    // Enter edit mode.
    await user.click(await screen.findByRole("button", { name: /Revise & resubmit/i }));

    // Edit mode shows a textarea for the question.
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect((textarea as HTMLTextAreaElement).value).toBe("Need help.");

    // "Submit revision" and "Cancel" buttons appear; "Revise & resubmit" disappears.
    expect(screen.getByRole("button", { name: /Submit revision/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revise & resubmit/i })).not.toBeInTheDocument();
  });

  it("Submit revision calls the revise-and-resubmit endpoint with updated answers", async () => {
    let capturedBody: unknown = null;
    reviseHandler = (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      // Return updated detail (now SUBMITTED after revision)
      return jsonResponse({
        id: 22,
        title: "Post-Revision",
        description: null,
        requesterId: 1,
        derivedStatus: "SUBMITTED",
        createdAt: "2026-04-18T00:00:00Z",
        updatedAt: "2026-04-27T00:00:00Z",
        items: [
          {
            id: 1, productId: 1, productName: "Analytics", subFeatureId: null, subFeatureName: null,
            teamName: null, templateId: null, templateVersionNumber: null,
            status: "SUBMITTED", complexity: null, reviewerId: null, reviewerName: null,
            reviewerStatus: "unclaimed", justification: null, rejectionReason: null,
            revisionCount: 1, originalProductId: null, originalProductName: null, isReviewable: false,
            submittedAt: "2026-04-27T00:00:00Z", reviewedAt: null, approvedBlendedRateId: null,
            displayOrder: 0, phaseLines: [], answers: [
              { questionId: 7, questionText: "Business need?", required: true, answerText: "Updated answer." },
            ],
          },
        ],
      });
    };

    detail = {
      id: 22,
      title: "Pre-Revision",
      description: null,
      productName: "Analytics",
      subFeatureName: null,
      templateId: null,
      templateVersionNumber: null,
      status: "NEEDS_REVISION",
      rejectionReason: "More context needed.",
      reviewerName: "SO Evans",
      reviewedAt: "2026-04-26T00:00:00Z",
      requesterId: 1,
      submittedAt: "2026-04-22T00:00:00Z",
      createdAt: "2026-04-20T00:00:00Z",
      updatedAt: "2026-04-26T00:00:00Z",
      phaseLines: [],
      answers: [
        { questionId: 7, questionText: "Business need?", required: true, answerText: "Original answer." },
      ],
    };

    renderAt("22");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Revise & resubmit/i }));

    // Edit the answer.
    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "Updated answer.");

    await user.click(screen.getByRole("button", { name: /Submit revision/i }));

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        answers: [{ questionId: 7, answerText: "Updated answer." }],
      });
    });
  });

  it("Drop item shows confirmation; 409 shows 'Cannot drop last item' message", async () => {
    dropHandler = () => new Response(null, { status: 409 });

    detail = {
      id: 23,
      title: "Last Item Request",
      description: null,
      productName: "Portal",
      subFeatureName: null,
      templateId: null,
      templateVersionNumber: null,
      status: "NEEDS_REVISION",
      rejectionReason: "Try a different product.",
      reviewerName: "SO Fox",
      reviewedAt: "2026-04-27T00:00:00Z",
      requesterId: 1,
      submittedAt: "2026-04-24T00:00:00Z",
      createdAt: "2026-04-22T00:00:00Z",
      updatedAt: "2026-04-27T00:00:00Z",
      phaseLines: [],
      answers: [],
    };

    renderAt("23");
    const user = userEvent.setup();

    // Open item kebab menu.
    await screen.findByRole("button", { name: /Revise & resubmit/i });
    await user.click(screen.getByRole("button", { name: /Item actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Drop item/i }));

    // Confirmation dialog should open.
    expect(await screen.findByText(/Drop this item\?/i)).toBeInTheDocument();

    // Confirm the drop — triggers 409.
    await user.click(screen.getByRole("button", { name: /^Drop item$/i }));

    // 409 guard: modal switches to "Cannot drop last item".
    await waitFor(() => {
      expect(screen.getByText(/Cannot drop last item/i)).toBeInTheDocument();
      expect(screen.getByText(/Discard the entire request instead/i)).toBeInTheDocument();
    });
    // "Discard request" confirm button should be present.
    expect(screen.getByRole("button", { name: /Discard request/i })).toBeInTheDocument();
  });

  it("Override values display with the 'Override' tag and contribute to row total", async () => {
    detail = {
      id: 12,
      title: "Override Display",
      description: null,
      productName: "Member Portal",
      subFeatureName: null,
      templateId: 5,
      templateVersionNumber: 2,
      status: "APPROVED",
      complexity: "MED",
      justification: "Build will need extra onshore.",
      reviewerName: "SO Lee",
      reviewedAt: "2026-04-25T00:00:00Z",
      approvedBlendedRateId: 1,
      requesterId: 1,
      submittedAt: "2026-04-15T00:00:00Z",
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-25T00:00:00Z",
      phaseLines: [
        {
          sdlcPhaseId: 1, sdlcPhaseName: "Build", displayOrder: 1,
          onshoreLow: 40, onshoreMed: 80, onshoreHigh: 120,
          offshoreLow: 20, offshoreMed: 40, offshoreHigh: 60,
          // Onshore Med override: 80 → 100 (delta +20).
          onshoreOverride: 100, offshoreOverride: null,
        },
      ],
      answers: [],
    };

    renderAt("12");

    expect(await screen.findByRole("heading", { name: "Override Display", level: 1 })).toBeInTheDocument();
    // The "Override" pill renders next to the overridden value (case-insensitive
    // match because the pill renders uppercase).
    await waitFor(() => {
      expect(screen.getByText(/^Override$/i)).toBeInTheDocument();
    });
    // Grand total row Total Hrs: 100 onshore (override) + 40 offshore = 140.
    expect(screen.getAllByText("140").length).toBeGreaterThan(0);
  });
});
