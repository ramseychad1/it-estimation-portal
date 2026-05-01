import { api } from "../api";

export type TeamStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export interface TeamListItem {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  productCount: number;
  updatedAt: string | null;
  updatedBy: number | null;
}

export interface TeamDto {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string | null;
  createdBy: number | null;
  updatedAt: string | null;
  updatedBy: number | null;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface TeamCreateRequest {
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface TeamUpdateRequest {
  name?: string;
  description?: string | null;
}

export interface BulkResult {
  succeeded: number[];
  failed: { id: number; error: string; message: string }[];
}

export interface TeamHistoryItem {
  id: number;
  action: "CREATED" | "UPDATED" | "ACTIVATED" | "DEACTIVATED" | "DELETED" | "REORDERED";
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: number | null;
  changedAt: string;
  notes: string | null;
}

export interface ListTeamsParams {
  search?: string;
  status?: TeamStatusFilter;
  page?: number;
  size?: number;
  sort?: string;
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

export function listTeams(params: ListTeamsParams = {}): Promise<PageResponse<TeamListItem>> {
  return api(`/admin/teams${toQuery(params as Record<string, unknown>)}`);
}

export function getTeam(id: number): Promise<TeamDto> {
  return api(`/admin/teams/${id}`);
}

export function createTeam(body: TeamCreateRequest): Promise<TeamDto> {
  return api(`/admin/teams`, { method: "POST", body });
}

export function updateTeam(id: number, body: TeamUpdateRequest): Promise<TeamDto> {
  return api(`/admin/teams/${id}`, { method: "PATCH", body });
}

export function activateTeam(id: number): Promise<TeamDto> {
  return api(`/admin/teams/${id}/activate`, { method: "POST" });
}

export function deactivateTeam(id: number): Promise<TeamDto> {
  return api(`/admin/teams/${id}/deactivate`, { method: "POST" });
}

export function deleteTeam(id: number): Promise<void> {
  return api(`/admin/teams/${id}`, { method: "DELETE" });
}

export function bulkActivateTeams(ids: number[]): Promise<BulkResult> {
  return api(`/admin/teams/bulk/activate`, { method: "POST", body: { ids } });
}

export function bulkDeactivateTeams(ids: number[]): Promise<BulkResult> {
  return api(`/admin/teams/bulk/deactivate`, { method: "POST", body: { ids } });
}

export function bulkDeleteTeams(ids: number[]): Promise<BulkResult> {
  return api(`/admin/teams/bulk`, { method: "DELETE", body: { ids } });
}

export function listTeamHistory(id: number): Promise<TeamHistoryItem[]> {
  return api(`/admin/teams/${id}/history`);
}

/**
 * URL builder for the CSV export. The browser handles auth via the existing
 * session cookie, so we use a plain anchor tag instead of fetch.
 */
export function teamsExportUrl(params: { search?: string; status?: TeamStatusFilter } = {}): string {
  return `/api/admin/teams/export${toQuery(params as Record<string, unknown>)}`;
}
