import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDashboardSummary,
  listDashboardActivity,
  type ListActivityParams,
} from "../api/dashboard";

export const DASHBOARD_KEY = ["dashboard"] as const;

/**
 * Stat-card summary. Refetched on window focus + on every mount so the
 * dashboard always reflects current state. {@code staleTime: 0} matches
 * the prompt — this surface exists to show "now."
 */
export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "summary"],
    queryFn: getDashboardSummary,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Activity feed. Same staleness contract as the summary. The {@code
 * mineOnly} toggle changes the cache key, so flipping it triggers a fresh
 * fetch automatically — no manual invalidation needed for the toggle.
 */
export function useDashboardActivityQuery(params: ListActivityParams) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "activity", params],
    queryFn: () => listDashboardActivity(params),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Convenience helper for the "Refresh" button. Invalidating the prefix
 * sweeps both the summary and every {@code mineOnly}/page combination of
 * the activity query in one call.
 */
export function useInvalidateDashboard() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
}
