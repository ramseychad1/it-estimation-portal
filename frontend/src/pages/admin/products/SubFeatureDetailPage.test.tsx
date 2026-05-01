import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../../lib/auth";
import { ToastProvider } from "../../../components/Toast";
import { SubFeatureDetailPage } from "./SubFeatureDetailPage";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface State {
  product: { id: number; name: string };
  subFeature: {
    id: number; productId: number; name: string; description: string | null;
    active: boolean; questionCount: number;
  };
  questions: Array<{ id: number; questionText: string; displayOrder: number; required: boolean; active: boolean }>;
  deleted: { id: number; confirmationName: string }[];
}
let state: State;

function installRouter() {
  state = {
    product: { id: 7, name: "Container Product" },
    subFeature: {
      id: 11, productId: 7, name: "Variant A",
      description: "First variant", active: true, questionCount: 0,
    },
    questions: [],
    deleted: [],
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
      return Promise.resolve(jsonResponse({
        ...state.product,
        description: null,
        mode: "CONTAINER",
        active: true,
        subFeatureCount: 1,
        questionCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        updatedBy: 1,
      }));
    }
    if (path === `/api/catalog/sub-features/${state.subFeature.id}` && method === "GET") {
      return Promise.resolve(jsonResponse({
        ...state.subFeature,
        questionCount: state.questions.length,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        updatedBy: 1,
      }));
    }
    if (path === `/api/catalog/sub-features/${state.subFeature.id}` && method === "DELETE") {
      const body = JSON.parse(init?.body as string);
      if (body.confirmationName.toLowerCase() !== state.subFeature.name.toLowerCase()) {
        return Promise.resolve(jsonResponse({ error: "VALIDATION_ERROR" }, 400));
      }
      state.deleted.push({ id: state.subFeature.id, confirmationName: body.confirmationName });
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (path === `/api/catalog/sub-features/${state.subFeature.id}/questions`) {
      return Promise.resolve(jsonResponse(state.questions.map((q) => ({
        id: q.id,
        parentType: "SubFeature",
        parentId: state.subFeature.id,
        parentName: state.subFeature.name,
        grandparentProductId: state.product.id,
        grandparentProductName: state.product.name,
        questionText: q.questionText,
        helpText: null,
        required: q.required,
        displayOrder: q.displayOrder,
        active: q.active,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        updatedBy: 1,
      }))));
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
              <Route
                path="/catalog/products/:productId/sub-features/:subFeatureId"
                element={<SubFeatureDetailPage />}
              />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("<SubFeatureDetailPage>", () => {
  it("breadcrumb renders the parent product and sub-feature names", async () => {
    renderAt("/catalog/products/7/sub-features/11");
    await screen.findByRole("heading", { level: 1, name: "Variant A" });
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(within(nav).getByText("Catalog")).toBeInTheDocument();
    expect(within(nav).getByText("Products")).toBeInTheDocument();
    expect(within(nav).getByText("Variant A")).toBeInTheDocument();
  });

  it("renders the template placeholder + Critical questions section", async () => {
    renderAt("/catalog/products/7/sub-features/11");
    await waitFor(
      () => expect(screen.getByText(/No questions yet/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(
      screen.getByText(/Estimate template editor coming with Phase 5b/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Critical questions/i })).toBeInTheDocument();
  });

  it("populated questions render with displayOrder pip + required pill", async () => {
    state.questions = [
      { id: 21, questionText: "First Q", displayOrder: 1, required: false, active: true },
      { id: 22, questionText: "Second Q", displayOrder: 2, required: true, active: true },
    ];
    renderAt("/catalog/products/7/sub-features/11");
    await waitFor(() => expect(screen.getByText("First Q")).toBeInTheDocument());
    expect(screen.getByText("Second Q")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("Delete from kebab → typed-name confirmation, then sub-feature is deleted", async () => {
    renderAt("/catalog/products/7/sub-features/11");
    const user = userEvent.setup();
    await screen.findByRole("heading", { level: 1, name: "Variant A" });

    await user.click(await screen.findByRole("button", { name: /Row actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Delete/i }));

    const dialog = await screen.findByRole("alertdialog");
    const input = within(dialog).getByLabelText(/Type the sub-feature name to confirm/i);
    // Wrong typed name keeps the confirm button disabled.
    await user.type(input, "wrong");
    expect(within(dialog).getByRole("button", { name: /Delete sub-feature/i })).toBeDisabled();

    await user.clear(input);
    await user.type(input, "Variant A");
    await user.click(within(dialog).getByRole("button", { name: /Delete sub-feature/i }));

    await waitFor(() => {
      expect(state.deleted).toHaveLength(1);
      expect(state.deleted[0].id).toBe(11);
    });
  });
});
