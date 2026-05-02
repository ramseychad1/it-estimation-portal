import { api } from "../api";
import type {
  Complexity,
  EstimateRequestDetail,
  EstimateRequestListItem,
  EstimateStatus,
} from "./estimates";
import type { PageResponse } from "./users";

export interface ListReviewQueueParams {
  status?: EstimateStatus;
  search?: string;
  productId?: number;
  mineOnly?: boolean;
  page?: number;
  size?: number;
}

export interface LineOverrideInput {
  sdlcPhaseId: number;
  /** null clears the override (revert to snapshot value). */
  onshoreOverride: number | null;
  /** null clears the override (revert to snapshot value). */
  offshoreOverride: number | null;
}

/**
 * Autosave payload. See backend SaveReviewStateRequest javadoc for the
 * null-vs-clear conventions — top-level null = "no change", in-line
 * null = "clear that override."
 */
export interface SaveReviewStateRequest {
  complexity?: Complexity | null;
  justification?: string | null;
  lineOverrides?: LineOverrideInput[];
}

export interface RejectRequest {
  justification: string;
}

export interface SendBackRequest {
  reason: string;
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

// ---- Queue + detail ---------------------------------------------------

export function listReviewQueue(
  params: ListReviewQueueParams = {},
): Promise<PageResponse<EstimateRequestListItem>> {
  return api(`/estimates/review${toQuery(params as Record<string, unknown>)}`);
}

export function getReviewDetail(id: number): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${id}`);
}

// ---- State transitions ------------------------------------------------

export function startReview(id: number): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${id}/start`, { method: "POST" });
}

export function releaseReview(id: number): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${id}/release`, { method: "POST" });
}

export function saveReviewState(
  id: number,
  body: SaveReviewStateRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${id}/state`, { method: "PUT", body });
}

export function approveReview(id: number): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${id}/approve`, { method: "POST" });
}

export function rejectReview(
  id: number,
  body: RejectRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${id}/reject`, { method: "POST", body });
}

// ---- Admin send-back --------------------------------------------------

export function sendBack(
  id: number,
  body: SendBackRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/admin/${id}/send-back`, { method: "POST", body });
}
