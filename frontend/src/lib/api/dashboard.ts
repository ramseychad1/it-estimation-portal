import { api } from "../api";
import type { PageResponse } from "./users";

/** Slim actor projection — same shape as ChangeLogActorDto on the audit feed. */
export interface ActivityActor {
  id: number | null;
  name: string;
}

export interface StatCard {
  /** Stable identifier used by the frontend to sort + key. */
  key: string;
  label: string;
  count: number;
  description?: string | null;
}

export interface DashboardSummary {
  cards: StatCard[];
}

/** One row in the dashboard activity feed. Mirrors backend ActivityFeedItem. */
export interface ActivityFeedItem {
  id: number;
  timestamp: string;
  actor: ActivityActor;
  description: string;
  entityType: string;
  /** Null when the entity has been hard-deleted. */
  entityHref: string | null;
  /** Pre-rendered action label ("Created" / "Submitted" / etc.). */
  actionLabel: string;
}

export interface ListActivityParams {
  /** When true, restrict the feed to the actor's own actions. */
  mineOnly?: boolean;
  page?: number;
  size?: number;
}

function toQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return api(`/dashboard/summary`);
}

export function listDashboardActivity(
  params: ListActivityParams = {},
): Promise<PageResponse<ActivityFeedItem>> {
  return api(`/dashboard/activity${toQuery(params as Record<string, unknown>)}`);
}
