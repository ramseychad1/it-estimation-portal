import { api } from "../api";
import type {
  Complexity,
  EstimateRequestDetail,
  EstimateRequestListItem,
} from "./estimates";
import type { PageResponse } from "./users";

export interface ListReviewQueueParams {
  status?: string;
  search?: string;
  productId?: number;
  teamId?: number;
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

export interface SendBackRequest {
  reason: string;
}

// ---- Per-item review action payloads (Phase 9b) -----------------------

export interface ApproveItemRequest {
  complexity: Complexity;
  justification?: string | null;
  lineOverrides?: LineOverrideInput[];
}

export interface RejectItemRequest {
  rejectionReason: string;
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

// ---- Per-item review actions (Phase 9b) --------------------------------

export function startItemReview(
  requestId: number,
  itemId: number,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${requestId}/items/${itemId}/start`, { method: "POST" });
}

export function releaseItemReview(
  requestId: number,
  itemId: number,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${requestId}/items/${itemId}/release`, { method: "POST" });
}

export function approveItem(
  requestId: number,
  itemId: number,
  body: ApproveItemRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${requestId}/items/${itemId}/approve`, { method: "POST", body });
}

export function rejectItem(
  requestId: number,
  itemId: number,
  body: RejectItemRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/review/${requestId}/items/${itemId}/reject`, { method: "POST", body });
}

export function sendBackItem(
  requestId: number,
  itemId: number,
  body: SendBackRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/admin/${requestId}/items/${itemId}/send-back`, { method: "POST", body });
}
