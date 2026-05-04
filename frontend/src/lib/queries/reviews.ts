import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveItem,
  getReviewDetail,
  listReviewQueue,
  rejectItem,
  releaseItemReview,
  sendBackItem,
  startItemReview,
  type ApproveItemRequest,
  type ListReviewQueueParams,
  type RejectItemRequest,
  type SendBackRequest,
} from "../api/reviews";

const REVIEWS_KEY = ["reviews"] as const;
const ESTIMATES_KEY = ["estimates"] as const;

function detailKey(id: number) {
  return [...REVIEWS_KEY, "detail", id] as const;
}

export function useReviewQueueQuery(params: ListReviewQueueParams) {
  return useQuery({
    queryKey: [...REVIEWS_KEY, "queue", params],
    queryFn: () => listReviewQueue(params),
  });
}

export function useReviewDetailQuery(id: number | null) {
  return useQuery({
    queryKey: detailKey(id ?? -1),
    queryFn: () => getReviewDetail(id as number),
    enabled: id != null,
  });
}

/**
 * Invalidate every cache that could be reading this request:
 *   - the review queue (list shape changed)
 *   - the review detail (this request's state changed)
 *   - the requester-side estimates queries (they share the same row)
 *
 * Used after every state-transition mutation.
 */
function invalidateAfterTransition(
  qc: ReturnType<typeof useQueryClient>,
  id: number,
) {
  qc.invalidateQueries({ queryKey: REVIEWS_KEY });
  qc.invalidateQueries({ queryKey: ESTIMATES_KEY });
  // Detail key is in REVIEWS_KEY's prefix, but call it explicitly so a
  // detail page open in another window picks up the change immediately.
  qc.invalidateQueries({ queryKey: detailKey(id) });
}

// ---- Per-item mutations (Phase 9b) ------------------------------------

export function useStartItemReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, itemId }: { requestId: number; itemId: number }) =>
      startItemReview(requestId, itemId),
    onSuccess: (_data, { requestId }) => invalidateAfterTransition(qc, requestId),
  });
}

export function useReleaseItemReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, itemId }: { requestId: number; itemId: number }) =>
      releaseItemReview(requestId, itemId),
    onSuccess: (_data, { requestId }) => invalidateAfterTransition(qc, requestId),
  });
}

export function useApproveItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      itemId,
      body,
    }: {
      requestId: number;
      itemId: number;
      body: ApproveItemRequest;
    }) => approveItem(requestId, itemId, body),
    onSuccess: (_data, { requestId }) => invalidateAfterTransition(qc, requestId),
  });
}

export function useRejectItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      itemId,
      body,
    }: {
      requestId: number;
      itemId: number;
      body: RejectItemRequest;
    }) => rejectItem(requestId, itemId, body),
    onSuccess: (_data, { requestId }) => invalidateAfterTransition(qc, requestId),
  });
}

export function useSendBackItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      itemId,
      body,
    }: {
      requestId: number;
      itemId: number;
      body: SendBackRequest;
    }) => sendBackItem(requestId, itemId, body),
    onSuccess: (_data, { requestId }) => invalidateAfterTransition(qc, requestId),
  });
}
