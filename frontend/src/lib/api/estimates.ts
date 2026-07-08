import { api } from "../api";
import type { PageResponse } from "./users";

// Item-level stored status (on each estimate_request_item)
export type EstimateStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_CLARIFICATION"
  | "RECALLED";

export type Complexity = "LOW" | "MED" | "HIGH";

// Updated: replaces old flat fields with derived multi-product fields
export interface EstimateRequestListItem {
  id: number;
  title: string;
  /** Derived from items: DRAFT / SUBMITTED / IN_REVIEW / PARTIALLY_APPROVED / APPROVED / NEEDS_REVISION */
  derivedStatus: string;
  itemCount: number;
  /** Comma-joined display string, e.g. "Member Portal, Provider · Login" */
  productNames: string;
  /** ISO date string "YYYY-MM-DD", or null if unknown. */
  goLiveDate: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  /** Full name of the user who submitted the request. Null on the self-service (My Requests) surface. */
  requesterName: string | null;
  /** "Unclaimed", a single reviewer's full name, or "Multiple" for multi-reviewer requests. */
  reviewerSummary: string | null;
  /** Count of APPROVED items. Used to show "N of M approved" on PARTIALLY_APPROVED rows. */
  approvedItemCount: number;
  /** Total number of active critical questions across all items. 0 if no questions configured. */
  totalQuestionsCount: number;
  /** Number of questions that have a saved answer across all items. */
  answeredQuestionsCount: number;
  /** "CATALOG" or "INTAKE". */
  requestType: string;
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
  onshoreOverride: number | null;
  offshoreOverride: number | null;
}

export interface AttachmentMeta {
  id: number;
  itemId: number;
  questionId: number;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

export interface EstimateRequestAnswerView {
  questionId: number;
  questionText: string;
  required: boolean;
  documentUploadEnabled: boolean;
  documentUploadRequired: boolean;
  /** Mirrors backend QuestionType; drives which input control renders. */
  questionType: "LONG_TEXT" | "SHORT_TEXT" | "YES_NO" | "SINGLE_SELECT" | "NUMBER";
  /** Options for SINGLE_SELECT questions; empty otherwise. */
  options: string[];
  answerText: string;
  attachments: AttachmentMeta[];
}

export type ReviewerStatus = "you" | "other-so" | "unclaimed";

// New: per-item DTO
export interface EstimateRequestItemDto {
  id: number;
  productId: number;
  productName: string;
  subFeatureId: number | null;
  subFeatureName: string | null;
  teamName: string | null;
  templateId: number | null;
  templateVersionNumber: number | null;
  status: EstimateStatus;
  complexity: Complexity | null;
  reviewerId: number | null;
  reviewerName: string | null;
  reviewerStatus: ReviewerStatus;
  justification: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedBlendedRateId: number | null;
  displayOrder: number;
  phaseLines: EstimateRequestPhaseLineView[];
  answers: EstimateRequestAnswerView[];
  rejectionReason: string | null;
  revisionCount: number;
  originalProductId: number | null;
  originalProductName: string | null;
  isReviewable: boolean;
  /** SO's clarification question; non-null only when status is NEEDS_CLARIFICATION. */
  clarificationNote: string | null;
  /** Requester's free-form reply; non-null once the requester has responded. */
  clarificationResponse: string | null;
  // ---- Pricing (V25) ----
  /** Null when the category has no pricing model assigned. */
  pricingModel: "TARGET_MARGIN" | "TIME_AND_MATERIALS" | null;
  tmMultiplier: number | null;
  tmTargetMarginPct: number | null;
  matBillableRate: number | null;
  matDiscountPct: number | null;
  // ---- Revenue Manager overrides (V27) ----
  rmPricingModel: "TARGET_MARGIN" | "TIME_AND_MATERIALS" | null;
  rmTmMultiplier: number | null;
  rmTmTargetMarginPct: number | null;
  rmMatBillableRate: number | null;
  rmMatDiscountPct: number | null;
  // ---- V30: intake workflow ----
  /** "SCOPE" (normal estimation item) or "CONTEXT" (intake requirements carrier). */
  itemType: string;
}

// Updated: parent-level detail with items[]
export interface EstimateRequestDetail {
  id: number;
  title: string;
  description: string | null;
  /** ISO date string "YYYY-MM-DD", or null if the requester selected "Unknown at this time". */
  goLiveDate: string | null;
  requesterId: number;
  /** Derived from items: DRAFT / SUBMITTED / IN_REVIEW / PARTIALLY_APPROVED / APPROVED / NEEDS_REVISION */
  derivedStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
  items: EstimateRequestItemDto[];
  categoryId: number | null;
  categoryName: string | null;
  programTypeIds: number[];
  programTypeNames: string[];
  clientId: number | null;
  clientName: string | null;
  programId: number | null;
  programName: string | null;
  // ---- Pricing review (V27 / V28) ----
  /** PENDING | IN_REVIEW | APPROVED | null (not applicable or feature disabled). */
  pricingReviewStatus: string | null;
  rmReviewerId: number | null;
  rmDiscountPct: number | null;
  rmNotes: string | null;
  rmReviewedAt: string | null;
  /** Context the requester supplied when sending this estimate for (re-)pricing review. */
  requesterPricingContext: string | null;
  /** "CATALOG" or "INTAKE". */
  requestType: string;
}

// For creating a new item in the draft
export interface CreateItemRequest {
  productId: number;
  subFeatureId?: number | null;
}

export interface CreateDraftRequest {
  title: string;
  description: string;
  /** ISO date string "YYYY-MM-DD", or null if "Unknown at this time". */
  goLiveDate?: string | null;
  categoryId: number;
  programTypeIds: number[];
  clientId: number;
  programId: number;
  /** Required for CATALOG requests; omit (or empty) for INTAKE. */
  items?: CreateItemRequest[];
  /** "CATALOG" (default) or "INTAKE". */
  requestType?: string;
}

export interface UpdateDraftRequest {
  title?: string;
  description?: string | null;
  /** Always included so the server can distinguish "clear to null" from "omit". */
  goLiveDate?: string | null;
  categoryId?: number | null;
  programTypeIds?: number[] | null;
  clientId?: number | null;
  programId?: number | null;
}

export interface AnswerInput {
  questionId: number;
  answerText: string;
}

export interface SaveAnswersRequest {
  answers: AnswerInput[];
}

export interface ListMyRequestsParams {
  status?: string;
  search?: string;
  page?: number;
  size?: number;
  allRequests?: boolean;
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

// Backward-compat: saves to items[0]. Use saveDraftItemAnswers for per-item control.
export function saveDraftAnswers(
  id: number,
  body: SaveAnswersRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/my/${id}/answers`, { method: "PUT", body });
}

// Per-item answer save (Phase 9a).
export function saveDraftItemAnswers(
  id: number,
  itemId: number,
  body: SaveAnswersRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/my/${id}/items/${itemId}/answers`, { method: "PUT", body });
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

// ---- Per-item requester revision actions (Phase 9b) ------------------

export interface ReviseAndResubmitRequest {
  productId?: number | null;
  subFeatureId?: number | null;
  answers?: AnswerInput[];
  /** Requester's free-form reply to the SO's clarification note. */
  clarificationResponse?: string | null;
}

export function reviseAndResubmitItem(
  id: number,
  itemId: number,
  body: ReviseAndResubmitRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/my/${id}/items/${itemId}/revise-and-resubmit`, { method: "POST", body });
}

export function dropItem(id: number, itemId: number): Promise<void> {
  return api(`/estimates/my/${id}/items/${itemId}`, { method: "DELETE" });
}

export function recallItem(
  id: number,
  itemId: number,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/my/${id}/items/${itemId}/recall`, { method: "POST" });
}

// ---- Requester-initiated pricing review (V28) -------------------------

export interface RequestPricingReviewRequest {
  context: string | null;
}

export function requestPricingReview(
  id: number,
  body: RequestPricingReviewRequest,
): Promise<EstimateRequestDetail> {
  return api(`/estimates/my/${id}/request-pricing-review`, { method: "POST", body });
}

// ---- Admin delete (hard delete, audit logged) -------------------------

export function adminDeleteRequest(id: number): Promise<void> {
  return api(`/estimates/admin/${id}`, { method: "DELETE" });
}
