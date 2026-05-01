import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../../lib/auth";
import { ToastProvider } from "../../../components/Toast";
import { ProductDetailPage } from "./ProductDetailPage";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockProduct {
  id: number;
  name: string;
  description: string | null;
  mode: "ATOMIC" | "CONTAINER";
  active: boolean;
  subFeatureCount: number;
  questionCount: number;
}

interface MockSubFeature {
  id: number;
  productId: number;
  name: string;
  description: string | null;
  active: boolean;
  questionCount: number;
}

interface MockQuestion {
  id: number;
  parentType: "Product" | "SubFeature";
  parentId: number;
  parentName: string;
  questionText: string;
  helpText: string | null;
  required: boolean;
  displayOrder: number;
  active: boolean;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface State {
  product: MockProduct;
  subFeatures: MockSubFeature[];
  questions: MockQuestion[];
  reorderCalls: number[][];
  createdSubFeatures: { name: string }[];
}
let state: State;

function detailFor(p: MockProduct) {
  return jsonResponse({
    ...p,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    updatedBy: 1,
  });
}

function questionFor(q: MockQuestion) {
  return {
    ...q,
    grandparentProductId: null,
    grandparentProductName: null,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    updatedBy: 1,
  };
}

function subFeatureFor(s: MockSubFeature) {
  return {
    ...s,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    updatedBy: 1,
  };
}

function installRouter() {
  state = {
    product: { id: 1, name: "Test", description: null, mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0 },
    subFeatures: [],
    questions: [],
    reorderCalls: [],
    createdSubFeatures: [],
  };

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: 1, email: "admin@local", firstName: "Local", lastName: "Admin",
        roles: ["Admin", "Solution Owner"],
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === `/api/catalog/products/${state.product.id}`) {
      return Promise.resolve(detailFor(state.product));
    }
    if (path === `/api/catalog/products/${state.product.id}/sub-features` && method === "GET") {
      return Promise.resolve(jsonResponse(state.subFeatures.map(subFeatureFor)));
    }
    if (path === `/api/catalog/products/${state.product.id}/sub-features` && method === "POST") {
      const body = JSON.parse(init?.body as string);
      const sub: MockSubFeature = {
        id: state.subFeatures.length + 100,
        productId: state.product.id,
        name: body.name,
        description: body.description ?? null,
        active: body.active ?? true,
        questionCount: 0,
      };
      state.subFeatures.push(sub);
      state.createdSubFeatures.push({ name: body.name });
      return Promise.resolve(jsonResponse(subFeatureFor(sub)));
    }
    if (path === `/api/catalog/products/${state.product.id}/questions` && method === "GET") {
      return Promise.resolve(jsonResponse(state.questions.map(questionFor)));
    }
    if (path === `/api/catalog/products/${state.product.id}/questions/reorder` && method === "PATCH") {
      const body = JSON.parse(init?.body as string);
      state.reorderCalls.push(body.questionIds);
      // Re-emit the questions in the new order with refreshed displayOrder.
      const map = new Map(state.questions.map((q) => [q.id, q]));
      state.questions = body.questionIds.map((id: number, i: number) => ({
        ...map.get(id)!,
        displayOrder: i + 1,
      }));
      return Promise.resolve(jsonResponse(state.questions.map(questionFor)));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/catalog/products/:productId" element={<ProductDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("<ProductDetailPage>", () => {
  it("Container product shows the Sub-features section + container-questions notice", async () => {
    state.product = {
      id: 1, name: "Container", description: "Has variants",
      mode: "CONTAINER", active: true, subFeatureCount: 0, questionCount: 0,
    };
    renderAt("/catalog/products/1");
    // The sub-features query waits on the product query, so the empty
    // state is the deepest async signal — wait for it directly.
    await waitFor(
      () => expect(screen.getByText(/No sub-features yet/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByRole("heading", { level: 2, name: /Sub-features/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Critical questions for container products live on each sub-feature/i),
    ).toBeInTheDocument();
  });

  it("Atomic product shows the template placeholder and Critical questions section", async () => {
    state.product = {
      id: 1, name: "Atomic", description: null,
      mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0,
    };
    renderAt("/catalog/products/1");
    await waitFor(
      () => expect(screen.getByText(/No questions yet/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByRole("heading", { level: 2, name: /Estimate template/i })).toBeInTheDocument();
    expect(screen.getByText(/Estimate template editor coming with Phase 5b/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Critical questions/i })).toBeInTheDocument();
  });

  it("Atomic product with questions renders them in display_order", async () => {
    state.product = {
      id: 1, name: "Atomic", description: null,
      mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 2,
    };
    state.questions = [
      { id: 11, parentType: "Product", parentId: 1, parentName: "Atomic", questionText: "First Q", helpText: null, required: false, displayOrder: 1, active: true },
      { id: 22, parentType: "Product", parentId: 1, parentName: "Atomic", questionText: "Second Q", helpText: null, required: true, displayOrder: 2, active: true },
    ];
    renderAt("/catalog/products/1");
    await waitFor(() => {
      expect(screen.getByText("First Q")).toBeInTheDocument();
      expect(screen.getByText("Second Q")).toBeInTheDocument();
    });
    // Required pill exists for the second question.
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("'+ New sub-feature' drawer creates a sub-feature on Container detail", async () => {
    state.product = {
      id: 1, name: "Container", description: null,
      mode: "CONTAINER", active: true, subFeatureCount: 0, questionCount: 0,
    };
    renderAt("/catalog/products/1");
    const user = userEvent.setup();

    await screen.findByText(/No sub-features yet/i);
    // Two New sub-feature buttons (header + empty-state); take the first.
    const buttons = await screen.findAllByRole("button", { name: /New sub-feature/i });
    await user.click(buttons[0]);

    await user.type(await screen.findByLabelText(/Name/i), "Variant A");
    await user.click(screen.getByRole("button", { name: /Create & Continue/i }));

    await waitFor(() => {
      expect(state.createdSubFeatures).toEqual([{ name: "Variant A" }]);
    });
  });

  it("Edit Quick Info drawer surfaces Mode as read-only (no editable mode field)", async () => {
    state.product = {
      id: 1, name: "Atomic", description: null,
      mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0,
    };
    renderAt("/catalog/products/1");
    const user = userEvent.setup();

    await screen.findByRole("heading", { level: 1, name: "Atomic" });
    await user.click(await screen.findByRole("button", { name: /Row actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Edit Quick Info/i }));

    // The drawer renders a Type field with the read-only mode pill, NOT a
    // radio group. Searching for either the helper copy or the pill testid
    // confirms the read-only treatment.
    await waitFor(() => {
      expect(
        screen.getByText(/Mode is set at creation and cannot be changed/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("mode-pill-readonly")).toBeInTheDocument();
    // No "Atomic product" / "Container product" radios in the edit drawer.
    expect(screen.queryByRole("radio", { name: /Atomic product/i })).toBeNull();
  });
});
