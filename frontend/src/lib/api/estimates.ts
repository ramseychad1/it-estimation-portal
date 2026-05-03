import { api } from "../api";
import type { PageResponse } from "./users";

export type EstimateStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type Complexity = "LOW" | "MED" | "HIGH";

export interface EstimateRequestListItem {
  id: number;
  title: string;
  productId: number;
  productName: string;
  subFeatureId: number | null;
  subFeatureName: string | null;
  status: EstimateStatus;
  submittedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface EstimateRequestPhaseLineView {
  sdlcPhaseId: number;
  sdlcPhaseName: string;
  displayOrder: number;
  onshoreLow: number;
  onshoreMed: number;
  onshoreHigh: number;
  offshoreLow: number;
  offshoreMed: number;
  offshoreHigh: number;
  /** Phase 6b — null in 6a. */
  onshoreOverride: number | null;
  /** Phase 6b — null in 6a. */
  offshoreOverride: number | null;
}

export interface EstimateRequestAnswerView {
  questionId: number;
  questionText: string;
  required: boolean;
  answerText: string;
}

export type ReviewerStatus = "you" | "other-so" | "unclaimed";

export interface EstimateRequestDetail {
  id: number;
  title: string;
  description: string | null;
  productId: number;
  productName: string;
  teamName: string | null;
  subFeatureId: number | null;
  subFeatureName: string | null;
  templateId: number | null;
  templateVersionNumber: number | null;
  complexity: Complexity | null;
  status: EstimateStatus;
  requesterId: number;
  reviewerId: number | null;
  /** Display name of the reviewer; null when unclaimed. */
  reviewerName: string | null;
  /** Per-actor relationship to the current reviewer — see backend DTO. */
  reviewerStatus: ReviewerStatus;
  justification: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** Snapshot of the blended-rate id at approval time (Phase 6b). */
  approvedBlendedRateId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  phaseLines: EstimateRequestPhaseLineView[];
  answers: EstimateRequestAnswerView[];
}

export interface CreateDraftRequest {
  title: string;
  productId: number;
  subFeatureId?: number | null;
  description?: string | null;
}

export interface UpdateDraftRequest {
  title?: string;
  description?: string | null;
}

export interface AnswerInput {
  questionId: number;
  answerText: string;
}

export interface SaveAnswersRequest {
  answers: AnswerInput[];
}

export interface ListMyRequestsParams {
  status?: EstimateStatus;
  search?: string;
  page?: number;
  size?: number;
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

export function listMyRequests(
  params: ListMyRequestsParams = {},
): Promise<PageResponse<EstimateRequestListItem>> {
  return api(`/estimates/my${toQuery(params as Record<string, unknown>)}`);
}

export function getMyRequest(id: number): Promise<EstimateRequestDetail> {
  return api(`/estimates/my/${id}`);
}

export function createDraft(body: CreateDraftRequest): Promise<EstimateRequestDetail> {
  return api(`/estimates/my`, { method: "POST", body });
}

export function updateDraft(
  id: number,
  body: UpdateDraftRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/my/${id}`, { method: "PATCH", body });
}

export function discardDraft(id: number): Promise<void> {
  return api(`/estimates/my/${id}`, { method: "DELETE" });
}

export function saveDraftAnswers(
  id: number,
  body: SaveAnswersRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/my/${id}/answers`, { method: "PUT", body });
}

export function submitRequest(id: number): Promise<EstimateRequestDetail> {
  return api(`/estimates/my/${id}/submit`, { method: "POST" });
}

export interface EstimateRequestHistoryItem {
  id: number;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: number | null;
  changedAt: string;
  notes: string | null;
}

export function listMyRequestHistory(id: number): Promise<EstimateRequestHistoryItem[]> {
  return api(`/estimates/my/${id}/history`);
}
