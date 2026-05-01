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
  product: { id: number; name: string };
  subFeature: {
    id: number; productId: number; name: string; description: string | null;
    active: boolean; questionCount: number;
  };
  questions: Array<{ id: number; questionText: string; displayOrder: number; required: boolean; active: boolean }>;
  deleted: { id: number; confirmationName: string }[];
  template: MockTemplate | null;
  templateSaves: { lines: MockTemplateLine[]; changeReason: string | null }[];
}
let state: State;

function defaultPhaseLines(): MockTemplateLine[] {
  return [
    { sdlcPhaseId: 1, sdlcPhaseName: "Discovery", sdlcPhaseDisplayOrder: 1, sdlcPhaseActive: true,
      onshoreLow: 0, onshoreMed: 0, onshoreHigh: 0, offshoreLow: 0, offshoreMed: 0, offshoreHigh: 0 },
    { sdlcPhaseId: 2, sdlcPhaseName: "Build", sdlcPhaseDisplayOrder: 2, sdlcPhaseActive: true,
      onshoreLow: 0, onshoreMed: 0, onshoreHigh: 0, offshoreLow: 0, offshoreMed: 0, offshoreHigh: 0 },
  ];
}

function installRouter() {
  state = {
    product: { id: 7, name: "Container Product" },
    subFeature: {
      id: 11, productId: 7, name: "Variant A",
      description: "First variant", active: true, questionCount: 0,
    },
    questions: [],
    deleted: [],
    template: null,
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
    // ---- Phase 5b: template endpoints --------------------------------
    if (path === `/api/catalog/sub-features/${state.subFeature.id}/template` && method === "GET") {
      if (!state.template) return Promise.resolve(jsonResponse(null));
      return Promise.resolve(jsonResponse({
        id: state.template.id,
        productId: null,
        subFeatureId: state.subFeature.id,
        versionNumber: state.template.versionNumber,
        active: state.template.active,
        changeReason: state.template.changeReason,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: 1,
        displayName: `Estimate template — v${state.template.versionNumber}`,
        lines: state.template.lines,
      }));
    }
    if (path === `/api/catalog/sub-features/${state.subFeature.id}/template` && method === "POST") {
      state.template = {
        id: 200,
        versionNumber: 1,
        active: true,
        changeReason: null,
        lines: defaultPhaseLines(),
      };
      return Promise.resolve(jsonResponse({
        id: state.template.id,
        productId: null,
        subFeatureId: state.subFeature.id,
        versionNumber: 1,
        active: true,
        changeReason: null,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: 1,
        displayName: "Estimate template — v1",
        lines: state.template.lines,
      }));
    }
    if (path === `/api/catalog/sub-features/${state.subFeature.id}/template` && method === "PUT") {
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
      return Promise.resolve(jsonResponse({
        id: state.template.id,
        productId: null,
        subFeatureId: state.subFeature.id,
        versionNumber: state.template.versionNumber,
        active: true,
        changeReason: body.changeReason,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: 1,
        displayName: `Estimate template — v${state.template.versionNumber}`,
        lines: state.template.lines,
      }));
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

  it("Day 1 sub-feature shows the template empty state alongside the questions section", async () => {
    renderAt("/catalog/products/7/sub-features/11");
    // Both empty states are independent React Query loads; wait for each.
    await screen.findByText(/No questions yet/i, undefined, { timeout: 3000 });
    await screen.findByText(/No template yet/i, undefined, { timeout: 3000 });
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

  // -------------------------------------------------------------------
  // Phase 5b — template editor inline on sub-feature detail
  // -------------------------------------------------------------------

  it("Day 1 sub-feature shows the '+ Create template' empty state", async () => {
    renderAt("/catalog/products/7/sub-features/11");
    await waitFor(
      () => expect(screen.getByText(/No template yet/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByRole("button", { name: /\+ Create template/i })).toBeInTheDocument();
  });

  it("Click '+ Create template' POSTs and the grid materializes", async () => {
    renderAt("/catalog/products/7/sub-features/11");
    const user = userEvent.setup();

    await screen.findByText(/No template yet/i);
    await user.click(screen.getByRole("button", { name: /\+ Create template/i }));

    await waitFor(() => {
      expect(screen.getByRole("table", { name: /Estimate template hours/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/v1 active/i)).toBeInTheDocument();
  });

  it("Save new version: editing a cell, clicking Save, version pill advances", async () => {
    state.template = {
      id: 200, versionNumber: 1, active: true, changeReason: null,
      lines: defaultPhaseLines(),
    };
    renderAt("/catalog/products/7/sub-features/11");
    const user = userEvent.setup();

    await screen.findByText(/v1 active/i);
    const cell = screen.getByLabelText("Build Onshore L") as HTMLInputElement;
    await user.click(cell);
    await user.clear(cell);
    await user.type(cell, "75");
    cell.blur();

    const saveBtn = screen.getByRole("button", { name: /Save changes/i });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    await user.click(saveBtn);

    await waitFor(() => {
      expect(state.templateSaves).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getByText(/v2 active/i)).toBeInTheDocument();
    });
    const buildLine = state.templateSaves[0].lines.find((l) => l.sdlcPhaseId === 2)!;
    expect(buildLine.onshoreLow).toBe(75);
  });
});
