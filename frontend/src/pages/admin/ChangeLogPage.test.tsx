import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeLogPage } from "./ChangeLogPage";
import { renderWithProviders } from "../../test/utils";
import type { ChangeLogGroup, ChangeLogPage as ChangeLogPageDto } from "../../lib/api/changeLog";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyPage(): ChangeLogPageDto {
  return { groups: [], page: 0, size: 50, totalElements: 0, hasMore: false };
}

function pageWith(groups: ChangeLogGroup[]): ChangeLogPageDto {
  return { groups, page: 0, size: 50, totalElements: groups.length, hasMore: false };
}

function group(overrides: Partial<ChangeLogGroup> = {}): ChangeLogGroup {
  return {
    id: "group-1",
    entityType: "Team",
    entityId: 5,
    entityName: "Application Development",
    entityDeleted: false,
    action: "UPDATED",
    actor: { id: 1, name: "Local Admin" },
    changedAt: new Date().toISOString(),
    source: "WEB",
    description: "Local Admin updated Team 'Application Development'",
    changes: [{ field: "name", oldValue: "App Dev", newValue: "Application Development" }],
    viewEntityHref: "/admin/teams",
    ...overrides,
  };
}

let listResponse: ChangeLogPageDto;

function installRouter() {
  listResponse = emptyPage();
  fetchMock.mockImplementation((url: string) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;

    if (path === "/api/auth/me") {
      return Promise.resolve(jsonResponse({
        id: 1,
        email: "admin@local",
        firstName: "Local",
        lastName: "Admin",
        roles: ["Admin"],
      }));
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === "/api/admin/change-log") {
      return Promise.resolve(jsonResponse(listResponse));
    }
    if (path === "/api/admin/change-log/filters") {
      return Promise.resolve(jsonResponse({
        entityTypes: [
          { value: "Team", label: "Team" },
          { value: "SdlcPhase", label: "SDLC Phase" },
        ],
        actions: [
          { value: "CREATED", label: "Created" },
          { value: "UPDATED", label: "Updated" },
          { value: "DELETED", label: "Deleted" },
        ],
        actors: [
          { id: 1, name: "Local Admin" },
          { id: 2, name: "Local Estimator" },
        ],
      }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(installRouter);
afterEach(() => fetchMock.mockReset());

describe("<ChangeLogPage>", () => {
  it("renders the empty state when no rows exist", async () => {
    listResponse = emptyPage();
    renderWithProviders(<ChangeLogPage />);
    await waitFor(() => {
      expect(screen.getByText(/No activity yet/i)).toBeInTheDocument();
    });
  });

  it("renders the filtered-empty state when filters yield no results", async () => {
    listResponse = emptyPage();
    renderWithProviders(<ChangeLogPage />);

    await screen.findByText(/No activity yet/i);

    // Apply a filter to enter "filtered" mode.
    const user = userEvent.setup();
    const entityTrigger = await screen.findByRole("button", { name: /^Entity:/ });
    await user.click(entityTrigger);
    // Two listboxes can match; scope to the one we just opened.
    const entityListbox = await screen.findByRole("listbox", { name: "Entity" });
    await user.click(within(entityListbox).getByRole("option", { name: "Team" }));

    await waitFor(() => {
      expect(screen.getByText(/No changes match your filters/i)).toBeInTheDocument();
    });
    // Two Reset-filters buttons by design: one in the toolbar (because a
    // filter is active) and one inside the empty-state panel.
    expect(screen.getAllByRole("button", { name: /Reset filters/i }).length).toBeGreaterThan(0);
  });

  it("renders date-grouped headers from a multi-day mock", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    listResponse = pageWith([
      group({ id: "group-1", changedAt: today.toISOString(), entityName: "Today's Team" }),
      group({
        id: "group-2",
        changedAt: yesterday.toISOString(),
        entityName: "Yesterday's Team",
        entityId: 6,
      }),
    ]);

    renderWithProviders(<ChangeLogPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Today" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Yesterday" })).toBeInTheDocument();
    });
  });

  it("expanding an UPDATED row reveals the Changes panel with field rows", async () => {
    listResponse = pageWith([
      group({
        changes: [
          { field: "name", oldValue: "App Dev", newValue: "Application Development" },
          { field: "description", oldValue: "Old", newValue: "New" },
        ],
      }),
    ]);

    renderWithProviders(<ChangeLogPage />);
    // Find the entry row by its description text rather than by role —
    // multiple buttons on the page have aria-expanded.
    const row = await findEntryRow();
    const user = userEvent.setup();
    await user.click(row);

    await waitFor(() => {
      expect(screen.getByText("Changes")).toBeInTheDocument();
    });
    expect(screen.getByText("App Dev")).toBeInTheDocument();
    expect(screen.getByText("Old")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("expanding a DELETED row reveals the Variant C deleted notice", async () => {
    listResponse = pageWith([
      group({
        action: "DELETED",
        entityDeleted: true,
        entityName: "Deleted team",
        viewEntityHref: undefined,
        changes: [],
        description: "Local Admin deleted Team 'Deleted team'",
      }),
    ]);

    renderWithProviders(<ChangeLogPage />);
    const row = await findEntryRow();
    const user = userEvent.setup();
    await user.click(row);

    await waitFor(() => {
      expect(
        screen.getByText(/This entity has been deleted/i),
      ).toBeInTheDocument();
    });
    // No View entity link — the entity is gone.
    expect(screen.queryByRole("link", { name: /View entity/i })).toBeNull();
  });

  it("renders the DELETED badge in Cardinal Red text (not a pill)", async () => {
    listResponse = pageWith([
      group({
        action: "DELETED",
        entityDeleted: true,
        entityName: "Gone",
        viewEntityHref: undefined,
        changes: [],
      }),
    ]);

    renderWithProviders(<ChangeLogPage />);
    const badge = await screen.findByText("DELETED");
    expect(badge).toHaveStyle({ color: "var(--color-cardinal-red)" });
    // Cardinal Red text styling is uppercase with letter-spacing — never a
    // pill. If anyone slaps a background on it later, this catches it.
    expect(badge).not.toHaveStyle({ background: "var(--color-cardinal-red)" });
  });

  it("Reset filters returns the filter state to defaults", async () => {
    listResponse = pageWith([group()]);
    renderWithProviders(<ChangeLogPage />);

    await findEntryRow();

    const user = userEvent.setup();
    const entityTrigger = await screen.findByRole("button", { name: /^Entity:/ });
    await user.click(entityTrigger);
    const entityListbox = await screen.findByRole("listbox", { name: "Entity" });
    await user.click(within(entityListbox).getByRole("option", { name: "Team" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Entity: Team/ })).toBeInTheDocument();
    });

    const resetButton = await screen.findByRole("button", { name: /Reset filters/i });
    await user.click(resetButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Entity: All/ })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Reset filters/i })).toBeNull();
  });
});

/**
 * Locate the entry row. The row is a div with role="button" and
 * aria-expanded, sitting under a list with role-less text. Find the
 * actor-name button (always present once the list renders) and walk up
 * to the row container.
 */
async function findEntryRow(): Promise<HTMLElement> {
  const actorButton = await screen.findByRole("button", { name: "Local Admin" });
  let node: HTMLElement | null = actorButton.parentElement;
  while (node && node.getAttribute("role") !== "button") {
    node = node.parentElement;
  }
  if (!node) throw new Error("Could not locate entry row");
  return node;
}
