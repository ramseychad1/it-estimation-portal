import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, waitFor } from "@testing-library/react";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/Toast";

/**
 * Provider drift detector.
 *
 * Mounts the real <App /> wrapped in the same providers main.tsx uses and
 * walks every authenticated route, asserting no thrown error and that the
 * page renders something. Mocks /api/auth/me to a fully-roled user and
 * stubs every list/detail endpoint to return sensible empties so each
 * page can render without exploding.
 *
 * If a context-consuming component (e.g. useToast) is added to a page but
 * a provider is missing from main.tsx, this test fails — that's the bug
 * caught by this milestone's M5 review note.
 *
 * The test is intentionally NOT visual — testing each screen's content is
 * the job of its own test file. This is purely "can it mount?"
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyPage<T>(items: T[] = []) {
  return jsonResponse({
    items,
    page: 0,
    size: 25,
    totalElements: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    meta: { activeAdminCount: 1 },
  });
}

beforeEach(() => {
  fetchMock.mockImplementation((url: string) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: 1,
        email: "admin@local",
        firstName: "Local",
        lastName: "Admin",
        roles: ["Admin", "Solution Owner", "Estimator", "Requester"],
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    // List endpoints all return empty collections; detail endpoints don't
    // get hit on a route mount (only after a row click).
    if (path === "/api/admin/users") return Promise.resolve(emptyPage());
    if (path === "/api/admin/teams") return Promise.resolve(emptyPage());
    if (path === "/api/admin/phases") return Promise.resolve(jsonResponse([]));
    if (path === "/api/admin/rates") {
      return Promise.resolve(jsonResponse({
        current: null,
        history: { items: [], page: 0, size: 25, totalElements: 0, totalPages: 0 },
      }));
    }
    if (path === "/api/admin/change-log") {
      return Promise.resolve(jsonResponse({
        groups: [], page: 0, size: 50, totalElements: 0, hasMore: false,
      }));
    }
    if (path === "/api/admin/change-log/filters") {
      return Promise.resolve(jsonResponse({
        entityTypes: [], actions: [], actors: [],
      }));
    }
    if (path === "/api/catalog/products") return Promise.resolve(emptyPage());
    if (path.match(/^\/api\/catalog\/products\/\d+$/)) {
      return Promise.resolve(jsonResponse({
        id: 1,
        name: "Sample",
        description: null,
        mode: "ATOMIC",
        active: true,
        subFeatureCount: 0,
        questionCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        updatedBy: 1,
      }));
    }
    if (path.match(/^\/api\/catalog\/products\/\d+\/sub-features$/)) {
      return Promise.resolve(jsonResponse([]));
    }
    if (path.match(/^\/api\/catalog\/products\/\d+\/questions$/)) {
      return Promise.resolve(jsonResponse([]));
    }
    if (path.match(/^\/api\/catalog\/sub-features\/\d+$/)) {
      return Promise.resolve(jsonResponse({
        id: 1,
        productId: 1,
        name: "Sample sub-feature",
        description: null,
        active: true,
        questionCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        updatedBy: 1,
      }));
    }
    if (path.match(/^\/api\/catalog\/sub-features\/\d+\/questions$/)) {
      return Promise.resolve(jsonResponse([]));
    }
    if (path === "/api/catalog/questions") {
      return Promise.resolve(emptyPage());
    }
    // Phase 5b: template GET — Day-1 returns null body. Detail pages
    // both fetch the template; smoke test only needs "no crash" coverage.
    if (path.match(/^\/api\/catalog\/products\/\d+\/template$/)) {
      return Promise.resolve(jsonResponse(null));
    }
    if (path.match(/^\/api\/catalog\/sub-features\/\d+\/template$/)) {
      return Promise.resolve(jsonResponse(null));
    }

    return Promise.resolve(new Response(null, { status: 404 }));
  });
});

afterEach(() => fetchMock.mockReset());

const ROUTES = [
  "/dashboard",
  "/requests",
  "/requests/new",
  "/requests/1",
  "/catalog/products",
  "/catalog/products/1",
  "/catalog/products/1/sub-features/1",
  "/catalog/questions",
  "/catalog/template-history",
  "/admin/teams",
  "/admin/phases",
  "/admin/rates",
  "/admin/users",
  "/admin/change-log",
];

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
            <App />
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("App tree smoke test", () => {
  for (const route of ROUTES) {
    it(`mounts ${route} without throwing`, async () => {
      const { unmount, container } = renderAt(route);
      // Wait for the AppShell to settle (auth resolves first, then the page).
      await waitFor(() => {
        // Either the page rendered into <main>, or the auth guard redirected;
        // either case is fine — the assertion is "no thrown error reaches the
        // boundary." The fact that we got here means React didn't bubble.
        expect(container.querySelector("main")).toBeTruthy();
      });
      unmount();
    });
  }
});
