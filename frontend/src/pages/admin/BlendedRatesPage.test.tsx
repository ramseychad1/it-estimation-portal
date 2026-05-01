import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlendedRatesPage } from "./BlendedRatesPage";
import { renderWithProviders } from "../../test/utils";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface MockRate {
  id: number;
  onshoreRate: string;
  offshoreRate: string;
  effectiveDate: string;
  note?: string | null;
  scheduled?: boolean;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface MockState {
  rates: MockRate[];
  postedBodies: unknown[];
}

let state: MockState;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function mapRate(r: MockRate, current: boolean) {
  return {
    id: r.id,
    onshoreRate: r.onshoreRate,
    offshoreRate: r.offshoreRate,
    effectiveDate: r.effectiveDate,
    note: r.note ?? null,
    createdAt: new Date().toISOString(),
    createdBy: 1,
    current,
    scheduled: r.scheduled ?? false,
  };
}

function installRouter() {
  state = { rates: [], postedBodies: [] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url, "http://localhost");
    const path = u.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === "/api/auth/me") {
      return Promise.resolve(
        jsonResponse({
          id: 1,
          email: "admin@local",
          firstName: "Local",
          lastName: "Admin",
          roles: ["Admin"],
        }),
      );
    }
    if (path === "/api/health") return Promise.resolve(jsonResponse({ status: "ok" }));

    if (path === "/api/admin/rates" && method === "GET") {
      // Find current = highest effective_date <= today
      const today = todayIso();
      const eligible = state.rates.filter((r) => r.effectiveDate <= today);
      eligible.sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1));
      const currentRow = eligible[0] ?? null;
      const items = [...state.rates].sort((a, b) =>
        a.effectiveDate < b.effectiveDate ? 1 : -1,
      );
      return Promise.resolve(
        jsonResponse({
          current: currentRow ? mapRate(currentRow, true) : null,
          history: {
            items: items.map((r) => mapRate(r, currentRow ? r.id === currentRow.id : false)),
            page: 0,
            size: 25,
            totalElements: items.length,
            totalPages: items.length === 0 ? 0 : 1,
          },
        }),
      );
    }
    if (path === "/api/admin/rates" && method === "POST") {
      const body = JSON.parse((init?.body as string) ?? "{}");
      state.postedBodies.push(body);
      const created = {
        id: state.rates.length + 1,
        onshoreRate: body.onshoreRate,
        offshoreRate: body.offshoreRate,
        effectiveDate: body.effectiveDate,
        note: body.note ?? null,
        scheduled: body.effectiveDate > todayIso(),
      };
      state.rates.push(created);
      return Promise.resolve(jsonResponse(mapRate(created, !created.scheduled), 201));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

beforeEach(() => installRouter());
afterEach(() => fetchMock.mockReset());

describe("<BlendedRatesPage>", () => {
  it("Day 1: shows the empty state and 'Set Initial Rates' CTA", async () => {
    state.rates = [];
    renderWithProviders(<BlendedRatesPage />);
    expect(await screen.findByText(/no rates set yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /set initial rates/i }),
    ).toBeInTheDocument();
    // Both rate cards display "Not set"
    expect(screen.getAllByText(/not set/i).length).toBeGreaterThan(0);
  });

  it("the page header CTA is hidden on Day 1", async () => {
    state.rates = [];
    renderWithProviders(<BlendedRatesPage />);
    await screen.findByText(/no rates set yet/i);
    // The "Update Rates" header button should NOT be present.
    expect(screen.queryByRole("button", { name: /^update rates$/i })).not.toBeInTheDocument();
  });

  it("opens 'Set Initial Rates' modal and the Save button is disabled until acknowledgement is checked", async () => {
    state.rates = [];
    const user = userEvent.setup();
    renderWithProviders(<BlendedRatesPage />);
    await screen.findByText(/no rates set yet/i);
    await user.click(screen.getByRole("button", { name: /set initial rates/i }));

    const dialog = await screen.findByRole("dialog", { name: /set initial rates/i });
    const onshore = within(dialog).getByLabelText(/onshore rate/i);
    const offshore = within(dialog).getByLabelText(/offshore rate/i);
    await user.type(onshore, "185.00");
    await user.type(offshore, "62.00");

    const save = within(dialog).getByRole("button", { name: /save initial rates/i });
    expect(save).toBeDisabled();

    await user.click(within(dialog).getByLabelText(/i understand this change will be recorded/i));
    expect(save).toBeEnabled();
  });

  it("submitting a valid form posts to /api/admin/rates, closes the modal, and refreshes", async () => {
    state.rates = [];
    const user = userEvent.setup();
    renderWithProviders(<BlendedRatesPage />);
    await screen.findByText(/no rates set yet/i);
    await user.click(screen.getByRole("button", { name: /set initial rates/i }));

    const dialog = await screen.findByRole("dialog", { name: /set initial rates/i });
    await user.type(within(dialog).getByLabelText(/onshore rate/i), "185.00");
    await user.type(within(dialog).getByLabelText(/offshore rate/i), "62.00");
    await user.click(within(dialog).getByLabelText(/i understand this change will be recorded/i));
    await user.click(within(dialog).getByRole("button", { name: /save initial rates/i }));

    await waitFor(() => {
      expect(state.postedBodies.length).toBe(1);
    });
    const posted = state.postedBodies[0] as {
      onshoreRate: string;
      offshoreRate: string;
      confirmationAcknowledged: boolean;
    };
    expect(posted.onshoreRate).toBe("185.00");
    expect(posted.offshoreRate).toBe("62.00");
    expect(posted.confirmationAcknowledged).toBe(true);

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /set initial rates/i })).not.toBeInTheDocument();
    });
    // Both the rate card and the history row now show the saved rate.
    await waitFor(() => {
      expect(screen.getAllByText(/\$185\.00/).length).toBeGreaterThan(0);
    });
  });

  it("future-dated rate renders the 'Scheduled' pill in the history table", async () => {
    state.rates = [
      { id: 1, onshoreRate: "185.00", offshoreRate: "62.00", effectiveDate: todayIso() },
      {
        id: 2,
        onshoreRate: "200.00",
        offshoreRate: "70.00",
        effectiveDate: tomorrowIso(),
        scheduled: true,
      },
    ];
    renderWithProviders(<BlendedRatesPage />);
    expect(await screen.findByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });
});
