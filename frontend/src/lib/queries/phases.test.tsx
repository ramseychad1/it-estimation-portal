import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useReorderPhasesMutation } from "./phases";
import type { SdlcPhaseListItem } from "../api/phases";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const BENCH = {
  benchmarkLowPct: null,
  benchmarkMidPct: null,
  benchmarkHighPct: null,
  defaultOffshorePct: 0,
  devAnchor: false,
};
const SEED: SdlcPhaseListItem[] = [
  { id: 1, name: "Analysis", description: null, displayOrder: 1, active: true, system: true, updatedAt: null, updatedBy: 1, ...BENCH },
  { id: 2, name: "Design", description: null, displayOrder: 2, active: true, system: true, updatedAt: null, updatedBy: 1, ...BENCH },
  { id: 3, name: "Development", description: null, displayOrder: 3, active: true, system: true, updatedAt: null, updatedBy: 1, ...BENCH },
];

describe("useReorderPhasesMutation", () => {
  it("paints the optimistic order immediately and confirms on success", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(SEED), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = makeClient();
    client.setQueryData(["phases", "list", "ALL"], SEED);

    const { result } = renderHook(() => useReorderPhasesMutation("ALL"), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      result.current.mutate([3, 1, 2]);
    });

    // Optimistic painting happens before the network resolves; assert that
    // the cache was updated in the order we requested.
    await waitFor(() => {
      const cached = client.getQueryData<SdlcPhaseListItem[]>(["phases", "list", "ALL"]);
      expect(cached?.map((p) => p.id)).toEqual([3, 1, 2]);
      expect(cached?.map((p) => p.displayOrder)).toEqual([1, 2, 3]);
    });
  });

  it("rolls back the cache on network failure", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );

    const client = makeClient();
    client.setQueryData(["phases", "list", "ALL"], SEED);

    const { result } = renderHook(() => useReorderPhasesMutation("ALL"), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync([3, 1, 2]);
      } catch {
        // expected — server returned 500
      }
    });

    await waitFor(() => {
      const cached = client.getQueryData<SdlcPhaseListItem[]>(["phases", "list", "ALL"]);
      expect(cached?.map((p) => p.id)).toEqual([1, 2, 3]);
    });
  });
});
