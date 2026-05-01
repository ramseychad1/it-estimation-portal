import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionsBrowserPage } from "./QuestionsBrowserPage";
import { renderWithProviders } from "../../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockQuestion {
  id: number;
  parentType: "Product" | "SubFeature";
  parentId: number;
  parentName: string;
  grandparentProductId: number | null;
  grandparentProductName: string | null;
  questionText: string;
  required: boolean;
  active: boolean;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function listFor(items: MockQuestion[]) {
  return jsonResponse({
    items: items.map((q) => ({
      ...q,
      helpText: null,
      displayOrder: 1,
      createdAt: "2026-01-01T00:00:00Z",
      createdBy: 1,
      updatedAt: "2026-01-01T00:00:00Z",
      updatedBy: 1,
    })),
    page: 0,
    size: 25,
    totalElements: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  });
}

interface State {
  questions: MockQuestion[];
}
let state: State;

function installRouter() {
  state = { questions: [] };
  fetchMock.mockImplementation((url: string) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const params = u.searchParams;

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: 1, email: "admin@local", firstName: "Local", lastName: "Admin",
        roles: ["Admin", "Solution Owner"],
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === "/api/catalog/questions") {
      const parentType = params.get("parentType");
      const filtered = parentType
        ? state.questions.filter((q) => q.parentType === parentType)
        : state.questions;
      return Promise.resolve(listFor(filtered));
    }
    const detailMatch = path.match(/^\/api\/catalog\/questions\/(\d+)$/);
    if (detailMatch) {
      const id = Number(detailMatch[1]);
      const found = state.questions.find((q) => q.id === id);
      if (!found) return Promise.resolve(new Response(null, { status: 404 }));
      return Promise.resolve(jsonResponse({
        ...found,
        helpText: null,
        displayOrder: 1,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        updatedBy: 1,
      }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

describe("<QuestionsBrowserPage>", () => {
  it("renders rows with parent attribution (parent type pill + parent name)", async () => {
    state.questions = [
      {
        id: 1, parentType: "Product", parentId: 10, parentName: "Atomic Prod",
        grandparentProductId: null, grandparentProductName: null,
        questionText: "Q on Product", required: false, active: true,
      },
      {
        id: 2, parentType: "SubFeature", parentId: 20, parentName: "Variant A",
        grandparentProductId: 30, grandparentProductName: "Container Prod",
        questionText: "Q on Sub-feature", required: true, active: true,
      },
    ];
    renderWithProviders(<QuestionsBrowserPage />);
    await waitFor(() => {
      expect(screen.getByText("Q on Product")).toBeInTheDocument();
      expect(screen.getByText("Q on Sub-feature")).toBeInTheDocument();
    });
    expect(screen.getByTestId("parent-type-pill-product")).toBeInTheDocument();
    expect(screen.getByTestId("parent-type-pill-subfeature")).toBeInTheDocument();
    expect(screen.getByText("Atomic Prod")).toBeInTheDocument();
    expect(screen.getByText("Variant A")).toBeInTheDocument();
  });

  it("Parent type filter narrows the list", async () => {
    state.questions = [
      {
        id: 1, parentType: "Product", parentId: 10, parentName: "Atomic Prod",
        grandparentProductId: null, grandparentProductName: null,
        questionText: "Product question", required: false, active: true,
      },
      {
        id: 2, parentType: "SubFeature", parentId: 20, parentName: "Variant A",
        grandparentProductId: 30, grandparentProductName: "Container Prod",
        questionText: "Subfeature question", required: false, active: true,
      },
    ];
    renderWithProviders(<QuestionsBrowserPage />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText("Product question")).toBeInTheDocument());

    await user.click(await screen.findByRole("button", { name: /Parent type:/i }));
    await user.click(await screen.findByRole("option", { name: "Sub-feature" }));

    await waitFor(() => {
      expect(screen.queryByText("Product question")).toBeNull();
      expect(screen.getByText("Subfeature question")).toBeInTheDocument();
    });
  });

  it("Row click opens the edit drawer (no navigation)", async () => {
    state.questions = [
      {
        id: 5, parentType: "Product", parentId: 10, parentName: "Atomic Prod",
        grandparentProductId: null, grandparentProductName: null,
        questionText: "Click me", required: false, active: true,
      },
    ];
    renderWithProviders(<QuestionsBrowserPage />);
    const user = userEvent.setup();

    await screen.findByText("Click me");
    await user.click(screen.getByText("Click me"));

    // The edit drawer mounts with the question text inside the form.
    // The Drawer component uses role="dialog".
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // The drawer's title reads "Edit question" and the question text is in
    // the textarea.
    expect(within(dialog).getByText(/Edit question/i)).toBeInTheDocument();
  });

  it("Empty + filtered-empty states render", async () => {
    state.questions = [];
    renderWithProviders(<QuestionsBrowserPage />);
    await waitFor(() => {
      expect(screen.getByText(/No critical questions yet/i)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    // Apply a filter to enter the filtered-empty state.
    await user.click(await screen.findByRole("button", { name: /Parent type:/i }));
    await user.click(await screen.findByRole("option", { name: "Product" }));

    await waitFor(() => {
      expect(screen.getByText(/No questions match your filters/i)).toBeInTheDocument();
    });
  });
});
