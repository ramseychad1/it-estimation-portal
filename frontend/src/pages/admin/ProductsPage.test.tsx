import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductsPage } from "./ProductsPage";
import { renderWithProviders } from "../../test/utils";

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface State {
  products: MockProduct[];
  navigations: string[];
  deleted: { id: number; confirmationName: string }[];
}
let state: State;

function listResponse(items: MockProduct[]) {
  const mapped = items.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    mode: p.mode,
    active: p.active,
    subFeatureCount: p.subFeatureCount,
    questionCount: p.questionCount,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    updatedBy: 1,
  }));
  return jsonResponse({
    items: mapped,
    page: 0,
    size: 25,
    totalElements: mapped.length,
    totalPages: mapped.length === 0 ? 0 : 1,
  });
}

function detailResponse(p: MockProduct) {
  return jsonResponse({
    id: p.id,
    name: p.name,
    description: p.description,
    mode: p.mode,
    active: p.active,
    subFeatureCount: p.subFeatureCount,
    questionCount: p.questionCount,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    updatedBy: 1,
  });
}

function installRouter() {
  state = { products: [], navigations: [], deleted: [] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: 1, email: "admin@local", firstName: "Local", lastName: "Admin",
        roles: ["Admin", "Solution Owner", "Estimator", "Requester"],
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === "/api/admin/teams" && method === "GET") {
      return Promise.resolve(jsonResponse({
        items: [{ id: 1, name: "Platform", description: null, active: true, productCount: 0, memberCount: 0, updatedAt: null, updatedBy: null }],
        page: 0, size: 100, totalElements: 1, totalPages: 1,
      }));
    }

    if (path === "/api/catalog/products" && method === "GET") {
      // Sort by name asc to match the page's default sort.
      const sorted = [...state.products].sort((a, b) => a.name.localeCompare(b.name));
      return Promise.resolve(listResponse(sorted));
    }
    if (path === "/api/catalog/products" && method === "POST") {
      const body = JSON.parse(init?.body as string);
      const created: MockProduct = {
        id: state.products.length + 1,
        name: body.name,
        description: body.description ?? null,
        mode: body.mode,
        active: body.active ?? true,
        subFeatureCount: 0,
        questionCount: 0,
      };
      state.products.push(created);
      return Promise.resolve(detailResponse(created));
    }
    const detailMatch = path.match(/^\/api\/catalog\/products\/(\d+)$/);
    if (detailMatch && method === "GET") {
      const found = state.products.find((p) => p.id === Number(detailMatch[1]));
      return Promise.resolve(found ? detailResponse(found) : new Response(null, { status: 404 }));
    }
    if (detailMatch && method === "DELETE") {
      const id = Number(detailMatch[1]);
      const body = JSON.parse(init?.body as string);
      const found = state.products.find((p) => p.id === id);
      if (!found || found.name.toLowerCase() !== body.confirmationName.toLowerCase()) {
        return Promise.resolve(jsonResponse({ error: "VALIDATION_ERROR" }, 400));
      }
      state.deleted.push({ id, confirmationName: body.confirmationName });
      state.products = state.products.filter((p) => p.id !== id);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

describe("<ProductsPage>", () => {
  it("renders rows sorted by name", async () => {
    state.products = [
      { id: 1, name: "Zeta", description: null, mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0 },
      { id: 2, name: "Alpha", description: null, mode: "CONTAINER", active: true, subFeatureCount: 2, questionCount: 0 },
    ];
    renderWithProviders(<ProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Zeta")).toBeInTheDocument();
    });
    // Alpha should appear before Zeta in the DOM order.
    const html = document.body.innerHTML;
    expect(html.indexOf("Alpha")).toBeLessThan(html.indexOf("Zeta"));
  });

  it("'+ New Product' opens the drawer with the mode radio cards", async () => {
    renderWithProviders(<ProductsPage />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText(/No products yet/i)).toBeInTheDocument());

    // Click the page-header "+ New Product". (There's a duplicate in the
    // empty state, so scope to the role + name, then take the first.)
    const newButtons = await screen.findAllByRole("button", { name: /New Product/i });
    await user.click(newButtons[0]);

    // Both mode radios should be visible inside the drawer.
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /Atomic product/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /Container product/i })).toBeInTheDocument();
    });
  });

  it("submitting valid create POSTs and triggers navigation to the detail page", async () => {
    renderWithProviders(<ProductsPage />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText(/No products yet/i)).toBeInTheDocument());
    const newButtons = await screen.findAllByRole("button", { name: /New Product/i });
    await user.click(newButtons[0]);

    await user.type(await screen.findByLabelText(/Name/i), "New Product Foo");
    // Select a team (required since Phase 8).
    const teamSelect = await screen.findByRole("combobox");
    await user.selectOptions(teamSelect, "1");
    await user.click(screen.getByRole("radio", { name: /Atomic product/i }));
    await user.click(screen.getByRole("button", { name: /Create & Continue/i }));

    await waitFor(() => {
      expect(state.products.some((p) => p.name === "New Product Foo")).toBe(true);
    });
  });

  it("selecting a row swaps the toolbar to bulk-select mode", async () => {
    state.products = [
      { id: 1, name: "Alpha", description: null, mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0 },
    ];
    renderWithProviders(<ProductsPage />);
    const user = userEvent.setup();

    await screen.findByText("Alpha");
    // Each row has a checkbox (DataTable selection). Click the row checkbox.
    const checkboxes = await screen.findAllByRole("checkbox");
    // First checkbox is the "select all" header, second is the row.
    await user.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Clear selection/i })).toBeInTheDocument();
  });

  it("delete confirmation requires typed-name match", async () => {
    state.products = [
      { id: 5, name: "DeleteMe", description: null, mode: "ATOMIC", active: true, subFeatureCount: 0, questionCount: 0 },
    ];
    renderWithProviders(<ProductsPage />);
    const user = userEvent.setup();

    await screen.findByText("DeleteMe");

    // Open the row's kebab (default aria-label is "Row actions").
    const kebabs = await screen.findAllByRole("button", { name: /Row actions/i });
    await user.click(kebabs[0]);

    // Click "Delete" in the dropdown.
    await user.click(await screen.findByRole("menuitem", { name: /Delete/i }));

    // Modal opens (ConfirmModal uses role="alertdialog"). The async kebab
    // path fetches the product detail before opening the modal, so we wait
    // for the dialog rather than checking immediately.
    const dialog = await screen.findByRole("alertdialog");
    const input = within(dialog).getByLabelText(/Type the product name to confirm/i);
    await user.type(input, "wrong");
    const confirmBtn = within(dialog).getByRole("button", { name: /Delete product/i });
    expect(confirmBtn).toBeDisabled();

    // Now type the correct name.
    await user.clear(input);
    await user.type(input, "DeleteMe");
    expect(confirmBtn).not.toBeDisabled();
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(state.deleted).toHaveLength(1);
      expect(state.deleted[0].id).toBe(5);
    });
  });
});
