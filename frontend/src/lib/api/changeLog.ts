import { api } from "../api";

export type ChangeAction =
  | "CREATED"
  | "UPDATED"
  | "ACTIVATED"
  | "DEACTIVATED"
  | "DELETED"
  | "REORDERED"
  | "PASSWORD_RESET"
  | "INVITATION_REVOKED"
  | "INVITATION_ACCEPTED";

export interface ChangeLogActor {
  id: number | null;
  name: string;
}

export interface ChangeLogChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ChangeLogGroup {
  id: string;
  entityType: string;
  entityId: number;
  entityName: string;
  entityDeleted: boolean;
  action: ChangeAction;
  actor: ChangeLogActor;
  changedAt: string;
  source: string;
  description: string;
  changes: ChangeLogChange[];
  /** Null when the entity has been deleted. */
  viewEntityHref?: string;
}

export interface ChangeLogPage {
  groups: ChangeLogGroup[];
  page: number;
  size: number;
  totalElements: number;
  hasMore: boolean;
}

export interface EntityFilterOption {
  value: string;
  label: string;
}

export interface ActionFilterOption {
  value: ChangeAction;
  label: string;
}

export interface UserFilterOption {
  id: number;
  name: string;
}

export interface ChangeLogFilterOptions {
  entityTypes: EntityFilterOption[];
  actions: ActionFilterOption[];
  actors: UserFilterOption[];
}

export interface ListChangeLogParams {
  search?: string;
  /** Comma-joined entity_type values (e.g. "Team,SdlcPhase"). */
  entityTypes?: string;
  /** Comma-joined ChangeAction values. */
  actions?: string;
  /** Comma-joined actor user ids. */
  actorIds?: string;
  /** ISO date or full instant. Bare yyyy-MM-dd is normalized to start of day. */
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sortDir?: "asc" | "desc";
}

function toQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export function listChangeLog(params: ListChangeLogParams = {}): Promise<ChangeLogPage> {
  return api(`/admin/change-log${toQuery(params as Record<string, unknown>)}`);
}

export function getChangeLogFilterOptions(): Promise<ChangeLogFilterOptions> {
  return api(`/admin/change-log/filters`);
}

export function changeLogExportUrl(params: ListChangeLogParams = {}): string {
  const merged = { format: "csv", ...params } as Record<string, unknown>;
  return `/api/admin/change-log/export${toQuery(merged)}`;
}
