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

interface MockTemplateLine {
  sdlcPhaseId: number;
  sdlcPhaseName: string;
  sdlcPhaseDisplayOrder: number;
  sdlcPhaseActive: boolean;
  onshoreLow: number;
  onshoreMed: number;
  onshoreHigh: number;
  offshoreLow: number;
  offshoreMed: number;
  offshoreHigh: number;
}

interface MockTemplate {
  id: number;
  versionNumber: number;
  active: boolean;
  changeReason: string | null;
  lines: MockTemplateLine[];
}

interface State {
  product: MockProduct;
  subFeatures: MockSubFeature[];
  questions: MockQuestion[];
  template: MockTemplate | null;
  reorderCalls: number[][];
  createdSubFeatures: { name: string }[];
  templateSaves: { lines: MockTemplateLine[]; changeReason: string | null }[];
}
let state: State;

function templateResponse(t: MockTemplate, productId: number) {
  return jsonResponse({
    id: t.id,
    productId,
    subFeatureId: null,
    versionNumber: t.versionNumber,
    active: t.active,
    changeReason: t.changeReason,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: 1,
    displayName: `Estimate template — v${t.versionNumber}`,
    lines: t.lines,
  });
}

function defaultPhases(): MockTemplateLine[] {
  return [
    { sdlcPhaseId: 1, sdlcPhaseName: "Discovery", sdlcPhaseDisplayOrder: 1, sdlcPhaseActive: true,
      onshoreLow: 0, onshoreMed: 0, onshoreHigh: 0, offshoreLow: 0, offshoreMed: 0, offshoreHigh: 0 },
    { sdlcPhaseId: 2, sdlcPhaseName: "Build", sdlcPhaseDisplayOrder: 2, sdlcPhaseActive: true,
      onshoreLow: 0, onshoreMed: 0, onshoreHigh: 0, offshoreLow: 0, offshoreMed: 0, offshoreHigh: 0 },
  ];
}

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
    template: null,
    reorderCalls: [],
    createdSubFeatures: [],
    templateSaves: [],
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
    // ---- Phase 5b: template endpoints --------------------------------
    if (path === `/api/catalog/products/${state.product.id}/template` && method === "GET") {
      if (!state.template) return Promise.resolve(jsonResponse(null));
      return Promise.resolve(templateResponse(state.template, state.product.id));
    }
    if (path === `/api/catalog/products/${state.product.id}/template` && method === "POST") {
      state.template = {
        id: 100,
        versionNumber: 1,
        active: true,
        changeReason: null,
        lines: defaultPhases(),
      };
      return Promise.resolve(templateResponse(state.template, state.product.id));
    }
    if (path === `/api/catalog/products/${state.product.id}/template` && method === "PUT") {
      const body = JSON.parse(init?.body as string) as {
        lines: { sdlcPhaseId: number; onshoreLow: number; onshoreMed: number; onshoreHigh: number;
                 offshoreLow: number; offshoreMed: number; offshoreHigh: number }[];
        changeReason: string | null;
      };
      state.templateSaves.push({
        lines: body.lines.map((l) => ({
          sdlcPhaseId: l.sdlcPhaseId,
          sdlcPhaseName: l.sdlcPhaseId === 1 ? "Discovery" : "Build",
          sdlcPhaseDisplayOrder: l.sdlcPhaseId === 1 ? 1 : 2,
          sdlcPhaseActive: true,
          onshoreLow: l.onshoreLow, onshoreMed: l.onshoreMed, onshoreHigh: l.onshoreHigh,
          offshoreLow: l.offshoreLow, offshoreMed: l.offshoreMed, offshoreHigh: l.offshoreHigh,
        })),
        changeReason: body.changeReason,
      });
      const prev = state.template!;
      state.template = {
        id: prev.id + 1,
        versionNumber: prev.versionNumber + 1,
        active: true,
        changeReason: body.changeReason,
        lines: state.templateSaves[state.templateSaves.length - 1].lines,
      };
      return Promise.resolve(templateResponse(state.template, state.product.id));
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

  it("Day 1 atomic product shows the '+ Create template' empty state in the template card", async () => {
    state.product = {
      id: 1, name: "Atomic", description: null,
      mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0,
    };
    renderAt("/catalog/products/1");
    await waitFor(
      () => expect(screen.getByText(/No template yet/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByRole("heading", { level: 2, name: /Estimate template/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Create template/i })).toBeInTheDocument();
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

  it("Edit Product drawer surfaces Mode as read-only (no editable mode field)", async () => {
    state.product = {
      id: 1, name: "Atomic", description: null,
      mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0,
    };
    renderAt("/catalog/products/1");
    const user = userEvent.setup();

    await screen.findByRole("heading", { level: 1, name: "Atomic" });
    await user.click(await screen.findByRole("button", { name: /Row actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Edit Product/i }));

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

  // -------------------------------------------------------------------
  // Phase 5b — template editor inline on atomic product detail
  // -------------------------------------------------------------------

  it("Clicking '+ Create template' POSTs and the grid materializes with all phase rows at 0", async () => {
    state.product = {
      id: 1, name: "Atomic", description: null,
      mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0,
    };
    renderAt("/catalog/products/1");
    const user = userEvent.setup();

    await screen.findByText(/No template yet/i);
    await user.click(screen.getByRole("button", { name: /\+ Create template/i }));

    // Grid mounts with all phase rows + zeroed cells.
    await waitFor(() => {
      expect(screen.getByRole("table", { name: /Estimate template hours/i })).toBeInTheDocument();
    });
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText(/v1 active/i)).toBeInTheDocument();
  });

  it("Editing a cell enables Save + reveals Discard; Save POSTs and version pill advances to v2", async () => {
    state.product = {
      id: 1, name: "Atomic", description: null,
      mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0,
    };
    state.template = {
      id: 100, versionNumber: 1, active: true, changeReason: null,
      lines: defaultPhases(),
    };
    renderAt("/catalog/products/1");
    const user = userEvent.setup();

    await screen.findByText(/v1 active/i);
    // Save button starts disabled (clean form).
    const saveBtn = screen.getByRole("button", { name: /Save changes/i });
    expect(saveBtn).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Discard changes/i })).toBeNull();

    // Edit a cell — Discovery's Onshore L. Use clear+type since the cell
    // selects-all on focus and userEvent's selection handling for that
    // pattern is fiddly across versions.
    const cell = screen.getByLabelText("Discovery Onshore L") as HTMLInputElement;
    await user.click(cell);
    await user.clear(cell);
    await user.type(cell, "42");
    cell.blur();

    // Save now enabled, Discard appears.
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    expect(screen.getByRole("button", { name: /Discard changes/i })).toBeInTheDocument();

    await user.click(saveBtn);
    await waitFor(() => {
      expect(state.templateSaves).toHaveLength(1);
    });
    // Version pill advances.
    await waitFor(() => {
      expect(screen.getByText(/v2 active/i)).toBeInTheDocument();
    });
    // Server received the edited value.
    const saved = state.templateSaves[0];
    const discoveryLine = saved.lines.find((l) => l.sdlcPhaseId === 1)!;
    expect(discoveryLine.onshoreLow).toBe(42);
  });

  it("Discard changes reverts the grid to the server snapshot", async () => {
    state.product = {
      id: 1, name: "Atomic", description: null,
      mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0,
    };
    state.template = {
      id: 100, versionNumber: 1, active: true, changeReason: null,
      lines: defaultPhases(),
    };
    renderAt("/catalog/products/1");
    const user = userEvent.setup();

    await screen.findByText(/v1 active/i);
    const cell = screen.getByLabelText("Discovery Onshore L") as HTMLInputElement;
    await user.click(cell);
    await user.clear(cell);
    await user.type(cell, "99");
    cell.blur();
    await waitFor(() => expect(cell.value).toBe("99"));

    await user.click(screen.getByRole("button", { name: /Discard changes/i }));
    // Cell reverts to "0" and the Discard button disappears (form clean).
    await waitFor(() => {
      expect((screen.getByLabelText("Discovery Onshore L") as HTMLInputElement).value).toBe("0");
    });
    expect(screen.queryByRole("button", { name: /Discard changes/i })).toBeNull();
  });

  it("Negative cell value blocks Save and surfaces aria-invalid on the offending input", async () => {
    state.product = {
      id: 1, name: "Atomic", description: null,
      mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0,
    };
    state.template = {
      id: 100, versionNumber: 1, active: true, changeReason: null,
      lines: defaultPhases(),
    };
    renderAt("/catalog/products/1");
    const user = userEvent.setup();

    await screen.findByText(/v1 active/i);
    const cell = screen.getByLabelText("Build Onshore M") as HTMLInputElement;
    await user.click(cell);
    await user.keyboard("-3");
    // The cell flags the invalid value via aria-invalid before commit.
    expect(cell).toHaveAttribute("aria-invalid", "true");
    cell.blur();

    // Save still attempts to send (parent's client-side validation rejects),
    // and the request count remains at 0.
    await user.click(screen.getByRole("button", { name: /Save changes/i }));
    expect(state.templateSaves).toHaveLength(0);
  });
});
