import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
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
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  requesterId: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  return jsonResponse({
    id: d.id,
    title: d.title,
    description: d.description,
    productId: 1,
    productName: d.productName,
    subFeatureId: d.subFeatureName ? 1 : null,
    subFeatureName: d.subFeatureName,
    templateId: d.templateId,
    templateVersionNumber: d.templateVersionNumber,
    complexity: null,
    status: d.status,
    requesterId: d.requesterId,
    reviewerId: null,
    justification: null,
    submittedAt: d.submittedAt,
    reviewedAt: null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    phaseLines: d.phaseLines,
    answers: d.answers,
  });
}

let detail: MockDetail | null;
let history: MockHistoryEntry[];

function installRouter() {
  detail = null;
  history = [];
  fetchMock.mockImplementation((url: string) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: 1, email: "requester@local", firstName: "Test", lastName: "Requester",
        roles: ["Requester"],
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    const detailMatch = path.match(/^\/api\/estimates\/my\/(\d+)$/);
    if (detailMatch) {
      if (!detail) return Promise.resolve(new Response(null, { status: 404 }));
      return Promise.resolve(detailResponse(detail));
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
});
