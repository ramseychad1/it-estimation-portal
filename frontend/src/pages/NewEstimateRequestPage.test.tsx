import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewEstimateRequestPage } from "./NewEstimateRequestPage";
import { renderWithProviders } from "../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockProduct {
  id: number;
  name: string;
  mode: "ATOMIC" | "CONTAINER";
}
interface MockSubFeature {
  id: number;
  productId: number;
  name: string;
  active: boolean;
}
interface MockQuestion {
  id: number;
  questionText: string;
  required: boolean;
  productId: number | null;
  subFeatureId: number | null;
  active: boolean;
}

interface MockDraftItem {
  productId: number;
  subFeatureId: number | null;
  answers: { questionId: number; answerText: string }[];
}

interface MockDraft {
  id: number;
  title: string;
  description: string | null;
  status: "DRAFT" | "SUBMITTED";
  items: MockDraftItem[];
}

let products: MockProduct[];
let subFeatures: MockSubFeature[];
let questions: MockQuestion[];
let drafts: MockDraft[];
let savedAnswers: { id: number; itemId: number; answers: { questionId: number; answerText: string }[] }[];
let submittedIds: number[];
let nextDraftId: number;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeDraftDetail(d: MockDraft) {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    requesterId: 1,
    derivedStatus: d.status,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
    items: d.items.map((it, idx) => {
      const p = products.find((pp) => pp.id === it.productId);
      const s = it.subFeatureId ? subFeatures.find((ss) => ss.id === it.subFeatureId) : null;
      return {
        id: d.id * 100 + idx + 1,
        productId: it.productId,
        productName: p?.name ?? "",
        subFeatureId: it.subFeatureId ?? null,
        subFeatureName: s?.name ?? null,
        teamName: null,
        templateId: null,
        templateVersionNumber: null,
        status: d.status,
        complexity: null,
        reviewerId: null,
        reviewerName: null,
        reviewerStatus: "unclaimed",
        justification: null,
        submittedAt: d.status === "SUBMITTED" ? new Date().toISOString() : null,
        reviewedAt: null,
        approvedBlendedRateId: null,
        displayOrder: idx,
        phaseLines: [],
        answers: it.answers.map((a) => {
          const q = questions.find((qq) => qq.id === a.questionId);
          return {
            questionId: a.questionId,
            questionText: q?.questionText ?? "",
            required: q?.required ?? false,
            answerText: a.answerText,
          };
        }),
      };
    }),
  };
}

function installRouter() {
  products = [];
  subFeatures = [];
  questions = [];
  drafts = [];
  savedAnswers = [];
  submittedIds = [];
  nextDraftId = 100;
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

    if (path === "/api/catalog/products" && method === "GET") {
      const items = products.map((p) => ({
        id: p.id, name: p.name, description: null, mode: p.mode, active: true,
        subFeatureCount: subFeatures.filter((s) => s.productId === p.id && s.active).length,
        questionCount: 0, createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
      }));
      return Promise.resolve(jsonResponse({
        items, page: 0, size: 100, totalElements: items.length, totalPages: 1,
      }));
    }

    const subListMatch = path.match(/^\/api\/catalog\/products\/(\d+)\/sub-features$/);
    if (subListMatch && method === "GET") {
      const pid = Number(subListMatch[1]);
      return Promise.resolve(jsonResponse(
        subFeatures.filter((s) => s.productId === pid)
      ));
    }

    const productQuestionsMatch = path.match(/^\/api\/catalog\/products\/(\d+)\/questions$/);
    if (productQuestionsMatch && method === "GET") {
      const pid = Number(productQuestionsMatch[1]);
      return Promise.resolve(jsonResponse(
        questions.filter((q) => q.productId === pid).map(toQuestionListItem)
      ));
    }
    const subQuestionsMatch = path.match(/^\/api\/catalog\/sub-features\/(\d+)\/questions$/);
    if (subQuestionsMatch && method === "GET") {
      const sid = Number(subQuestionsMatch[1]);
      return Promise.resolve(jsonResponse(
        questions.filter((q) => q.subFeatureId === sid).map(toQuestionListItem)
      ));
    }

    if (path === "/api/estimates/my" && method === "POST") {
      const body = JSON.parse(init?.body as string);
      const created: MockDraft = {
        id: nextDraftId++,
        title: body.title,
        description: body.description ?? null,
        status: "DRAFT",
        items: (body.items ?? []).map((it: { productId: number; subFeatureId?: number | null }) => ({
          productId: it.productId,
          subFeatureId: it.subFeatureId ?? null,
          answers: [],
        })),
      };
      drafts.push(created);
      return Promise.resolve(jsonResponse(makeDraftDetail(created), 201));
    }

    const detailMatch = path.match(/^\/api\/estimates\/my\/(\d+)$/);
    if (detailMatch && method === "GET") {
      const found = drafts.find((d) => d.id === Number(detailMatch[1]));
      if (!found) return Promise.resolve(new Response(null, { status: 404 }));
      return Promise.resolve(jsonResponse(makeDraftDetail(found)));
    }
    if (detailMatch && method === "PATCH") {
      const id = Number(detailMatch[1]);
      const body = JSON.parse(init?.body as string);
      const found = drafts.find((d) => d.id === id);
      if (!found) return Promise.resolve(new Response(null, { status: 404 }));
      if (body.title != null) found.title = body.title;
      if (body.description !== undefined) found.description = body.description;
      return Promise.resolve(jsonResponse(makeDraftDetail(found)));
    }

    // Per-item answers endpoint (Phase 9a)
    const itemAnswersMatch = path.match(/^\/api\/estimates\/my\/(\d+)\/items\/(\d+)\/answers$/);
    if (itemAnswersMatch && method === "PUT") {
      const id = Number(itemAnswersMatch[1]);
      const itemId = Number(itemAnswersMatch[2]);
      const body = JSON.parse(init?.body as string);
      savedAnswers.push({ id, itemId, answers: body.answers });
      const found = drafts.find((d) => d.id === id);
      if (found) {
        // itemId = draftId * 100 + idx + 1 → idx = itemId - (draftId*100 + 1)
        const idx = itemId - (id * 100 + 1);
        if (found.items[idx]) {
          found.items[idx].answers = body.answers;
        }
      }
      return Promise.resolve(jsonResponse(found ? makeDraftDetail(found) : {}));
    }

    // Backward-compat: old answers endpoint maps to items[0]
    const answersMatch = path.match(/^\/api\/estimates\/my\/(\d+)\/answers$/);
    if (answersMatch && method === "PUT") {
      const id = Number(answersMatch[1]);
      const body = JSON.parse(init?.body as string);
      const found = drafts.find((d) => d.id === id);
      if (found && found.items[0]) {
        found.items[0].answers = body.answers;
        savedAnswers.push({ id, itemId: id * 100 + 1, answers: body.answers });
      }
      return Promise.resolve(jsonResponse(found ? makeDraftDetail(found) : {}));
    }

    const submitMatch = path.match(/^\/api\/estimates\/my\/(\d+)\/submit$/);
    if (submitMatch && method === "POST") {
      const id = Number(submitMatch[1]);
      submittedIds.push(id);
      const found = drafts.find((d) => d.id === id);
      if (found) found.status = "SUBMITTED";
      return Promise.resolve(jsonResponse(makeDraftDetail(found!)));
    }

    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

function toQuestionListItem(q: MockQuestion) {
  return {
    id: q.id,
    questionText: q.questionText,
    helpText: null,
    required: q.required,
    displayOrder: q.id,
    active: q.active,
    productId: q.productId,
    subFeatureId: q.subFeatureId,
    parentType: q.productId ? "Product" : "SubFeature",
    createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
  };
}

function renderAt(initial: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/requests/new" element={<NewEstimateRequestPage />} />
      <Route path="/requests/:id" element={<DetailStub />} />
      <Route path="/requests" element={<ListStub />} />
    </Routes>,
    { initialEntries: [initial] },
  );
}

function DetailStub() { return <div data-testid="detail-stub" />; }
function ListStub() { return <div data-testid="list-stub" />; }

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

describe("<NewEstimateRequestPage>", () => {
  it("Step 1: container product reveals the sub-feature picker", async () => {
    products = [
      { id: 1, name: "Container", mode: "CONTAINER" },
      { id: 2, name: "Atomic", mode: "ATOMIC" },
    ];
    subFeatures = [
      { id: 10, productId: 1, name: "Variant A", active: true },
      { id: 11, productId: 1, name: "Variant B", active: true },
    ];

    renderAt("/requests/new");
    const user = userEvent.setup();

    // Wait for the product browser to load
    await screen.findByLabelText(/Estimate name/i);

    // Click the Container product — it expands an inline sub-feature list
    await user.click(await screen.findByRole("button", { name: /Container/i }));

    // Sub-features appear as inline buttons
    expect(await screen.findByRole("button", { name: "Variant A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Variant B" })).toBeInTheDocument();
  });

  it("Save as draft persists across step navigation", async () => {
    products = [{ id: 1, name: "Atomic", mode: "ATOMIC" }];
    questions = [
      { id: 100, productId: 1, subFeatureId: null, questionText: "Q1?", required: true, active: true },
    ];

    renderAt("/requests/new");
    const user = userEvent.setup();

    await user.type(
      await screen.findByLabelText(/Estimate name/i),
      "Persist test",
    );

    // Click the atomic product — it is added to the cart immediately
    await user.click(await screen.findByRole("button", { name: /^Atomic$/ }));

    // Cart confirms 1 item added
    await screen.findByText("1 item");

    await user.click(screen.getByRole("button", { name: /Save draft/i }));

    // The Draft should be created server-side.
    await waitFor(() => {
      expect(drafts.length).toBe(1);
      expect(drafts[0].title).toBe("Persist test");
    });

    // Continue to step 2 — the URL should now carry both step + id.
    await user.click(screen.getByRole("button", { name: /^Continue$/ }));
    // Step 2 renders the item in the rail and accordion
    await screen.findAllByText("Atomic");
  });

  it("Step 2: required question without answer disables Continue", async () => {
    products = [{ id: 1, name: "Atomic", mode: "ATOMIC" }];
    questions = [
      { id: 200, productId: 1, subFeatureId: null, questionText: "Required Q?", required: true, active: true },
    ];
    // Pre-seed a Draft and land directly on step 2 via the URL.
    drafts.push({
      id: 500, title: "Pre-seeded", description: null, status: "DRAFT",
      items: [{ productId: 1, subFeatureId: null, answers: [] }],
    });

    renderAt("/requests/new?step=2&id=500");
    const user = userEvent.setup();

    // First accordion item is open by default; question should be visible
    await screen.findByText("Required Q?");
    expect(screen.getByRole("button", { name: /^Continue$/ })).toBeDisabled();

    await user.type(screen.getByLabelText(/Answer to: Required Q\?/i), "An answer");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Continue$/ })).not.toBeDisabled();
    });
  });

  it("Step 2: save failure with fieldErrors decorates the offending textarea with aria-invalid", async () => {
    products = [{ id: 1, name: "Atomic", mode: "ATOMIC" }];
    questions = [
      { id: 40, productId: 1, subFeatureId: null, questionText: "Scope?", required: true, active: true },
    ];
    drafts.push({
      id: 600, title: "Error Test", description: null, status: "DRAFT",
      items: [{ productId: 1, subFeatureId: null, answers: [] }],
    });

    // Override the answers endpoint to return a 400 with fieldErrors.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = new URL(url, "http://localhost");
      const path = u.pathname;
      const method = (init?.method ?? "GET").toUpperCase();
      if (path === "/api/auth/me") {
        return Promise.resolve(jsonResponse({ id: 1, email: "r@local", firstName: "T", lastName: "R", roles: ["Requester"] }));
      }
      if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));
      if (path === "/api/catalog/products" && method === "GET") {
        return Promise.resolve(jsonResponse({ items: [{ id: 1, name: "Atomic", description: null, mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 1, createdAt: null, createdBy: null, updatedAt: null, updatedBy: null }], page: 0, size: 100, totalElements: 1, totalPages: 1 }));
      }
      if (path.match(/^\/api\/catalog\/products\/\d+\/questions$/) && method === "GET") {
        return Promise.resolve(jsonResponse([{ id: 40, questionText: "Scope?", helpText: null, required: true, displayOrder: 1, active: true, productId: 1, subFeatureId: null, parentType: "Product", createdAt: null, createdBy: null, updatedAt: null, updatedBy: null }]));
      }
      if (path.match(/^\/api\/estimates\/my\/600$/) && method === "GET") {
        return Promise.resolve(jsonResponse({ id: 600, title: "Error Test", description: null, requesterId: 1, derivedStatus: "DRAFT", createdAt: null, updatedAt: null, items: [{ id: 60001, productId: 1, productName: "Atomic", subFeatureId: null, subFeatureName: null, teamName: null, templateId: null, templateVersionNumber: null, status: "DRAFT", complexity: null, reviewerId: null, reviewerName: null, reviewerStatus: "unclaimed", justification: null, rejectionReason: null, revisionCount: 0, originalProductId: null, originalProductName: null, isReviewable: false, submittedAt: null, reviewedAt: null, approvedBlendedRateId: null, displayOrder: 0, phaseLines: [], answers: [] }] }));
      }
      if (path.match(/^\/api\/estimates\/my\/\d+\/items\/\d+\/answers$/) && method === "PUT") {
        // Simulate backend rejecting because required answer is empty.
        return Promise.resolve(jsonResponse({ errorCode: "VALIDATION_ERROR", message: "Required answer is missing.", fieldErrors: { "question:40": "Required answer is missing." } }, 400));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderAt("/requests/new?step=2&id=600");
    const user = userEvent.setup();

    await screen.findByText("Scope?");
    await user.click(screen.getByRole("button", { name: /Save draft/i }));

    await waitFor(() => {
      const textarea = screen.getByLabelText(/Answer to: Scope\?/i);
      expect(textarea).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("Step 3: Inline confirmation enables Submit and navigates to detail", async () => {
    products = [{ id: 1, name: "Atomic", mode: "ATOMIC" }];
    questions = [
      { id: 300, productId: 1, subFeatureId: null, questionText: "Q?", required: true, active: true },
    ];
    drafts.push({
      id: 700, title: "To submit", description: null, status: "DRAFT",
      items: [{ productId: 1, subFeatureId: null, answers: [{ questionId: 300, answerText: "Yes" }] }],
    });

    renderAt("/requests/new?step=3&id=700");
    const user = userEvent.setup();

    // Step 3 ready banner
    await screen.findByText(/Everything looks ready to submit/i);

    // Submit button is disabled until the confirmation checkbox is checked
    expect(screen.getByRole("button", { name: /Submit estimate request/i })).toBeDisabled();

    // Check the confirmation checkbox
    await user.click(screen.getByRole("checkbox"));

    // Submit button becomes enabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit estimate request/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /Submit estimate request/i }));

    await waitFor(() => {
      expect(submittedIds).toContain(700);
    });
    // Navigated to /requests/:id (DetailStub).
    expect(await screen.findByTestId("detail-stub")).toBeInTheDocument();
  });
});
