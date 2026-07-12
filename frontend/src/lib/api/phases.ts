import { api } from "../api";

export type PhaseStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export interface SdlcPhaseListItem {
  id: number;
  name: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
  system: boolean;
  updatedAt: string | null;
  updatedBy: number | null;
}

export interface SdlcPhaseDto {
  id: number;
  name: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
  system: boolean;
  createdAt: string | null;
  createdBy: number | null;
  updatedAt: string | null;
  updatedBy: number | null;
}

export interface SdlcPhaseCreateRequest {
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface SdlcPhaseUpdateRequest {
  name?: string;
  description?: string | null;
}

export interface SdlcPhaseHistoryItem {
  id: number;
  action: "CREATED" | "UPDATED" | "ACTIVATED" | "DEACTIVATED" | "DELETED" | "REORDERED";
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: number | null;
  changedAt: string;
  notes: string | null;
}

// ── Phase benchmarks (dev-hours estimator config) ────────────────────────────
// Percentages are fractions (0.35 = 35%).

export interface PhaseBenchmarkRow {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
  benchmarkLowPct: number | null;
  benchmarkTargetPct: number | null;
  benchmarkHighPct: number | null;
  defaultOffshorePct: number;
  devAnchor: boolean;
}

export interface PhaseBenchmarks {
  defaultContingencyPct: number;
  phases: PhaseBenchmarkRow[];
}

export interface PhaseBenchmarksUpdate {
  defaultContingencyPct: number;
  phases: Array<{
    id: number;
    benchmarkLowPct: number | null;
    benchmarkTargetPct: number | null;
    benchmarkHighPct: number | null;
    defaultOffshorePct: number;
    devAnchor: boolean;
  }>;
}

export function getPhaseBenchmarks(): Promise<PhaseBenchmarks> {
  return api(`/admin/phases/benchmarks`);
}

export function savePhaseBenchmarks(body: PhaseBenchmarksUpdate): Promise<PhaseBenchmarks> {
  return api(`/admin/phases/benchmarks`, { method: "PUT", body });
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

export function listPhases(status?: PhaseStatusFilter): Promise<SdlcPhaseListItem[]> {
  return api(`/admin/phases${toQuery({ status })}`);
}

export function getPhase(id: number): Promise<SdlcPhaseDto> {
  return api(`/admin/phases/${id}`);
}

export function createPhase(body: SdlcPhaseCreateRequest): Promise<SdlcPhaseDto> {
  return api(`/admin/phases`, { method: "POST", body });
}

export function updatePhase(id: number, body: SdlcPhaseUpdateRequest): Promise<SdlcPhaseDto> {
  return api(`/admin/phases/${id}`, { method: "PATCH", body });
}

export function activatePhase(id: number): Promise<SdlcPhaseDto> {
  return api(`/admin/phases/${id}/activate`, { method: "POST" });
}

export function deactivatePhase(id: number): Promise<SdlcPhaseDto> {
  return api(`/admin/phases/${id}/deactivate`, { method: "POST" });
}

export function deletePhase(id: number): Promise<void> {
  return api(`/admin/phases/${id}`, { method: "DELETE" });
}

export function reorderPhases(phaseIds: number[]): Promise<SdlcPhaseListItem[]> {
  return api(`/admin/phases/reorder`, { method: "PATCH", body: { phaseIds } });
}

export function listPhaseHistory(id: number): Promise<SdlcPhaseHistoryItem[]> {
  return api(`/admin/phases/${id}/history`);
}
