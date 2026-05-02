import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveReview,
  getReviewDetail,
  listReviewQueue,
  rejectReview,
  releaseReview,
  saveReviewState,
  sendBack,
  startReview,
  type ListReviewQueueParams,
  type RejectRequest,
  type SaveReviewStateRequest,
  type SendBackRequest,
} from "../api/reviews";
import type { EstimateRequestDetail } from "../api/estimates";

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

export function useStartReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => startReview(id),
    onSuccess: (_data, id) => invalidateAfterTransition(qc, id),
  });
}

export function useReleaseReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => releaseReview(id),
    onSuccess: (_data, id) => invalidateAfterTransition(qc, id),
  });
}

/**
 * Autosave mutation with optimistic cache updates. The page debounces
 * inputs upstream (1s); this hook just fires the PUT and rolls back on
 * error so the form stays consistent with what the server accepted.
 */
export function useSaveReviewStateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SaveReviewStateRequest }) =>
      saveReviewState(id, body),
    onMutate: async ({ id, body }) => {
      // Snapshot for rollback. Optimistically merge the new fields into
      // the cached detail so the UI stays in sync without waiting for
      // the response. Per-line overrides aren't merged optimistically —
      // computing the resulting line state here duplicates server logic
      // and the autosave round-trip is fast enough that a brief lag is
      // acceptable. Top-level fields are simple property writes.
      await qc.cancelQueries({ queryKey: detailKey(id) });
      const prev = qc.getQueryData<EstimateRequestDetail>(detailKey(id));
      if (prev) {
        qc.setQueryData<EstimateRequestDetail>(detailKey(id), {
          ...prev,
          complexity: body.complexity !== undefined ? body.complexity : prev.complexity,
          justification:
            body.justification !== undefined ? body.justification : prev.justification,
        });
      }
      return { prev };
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.prev) qc.setQueryData(detailKey(id), ctx.prev);
    },
    onSettled: (_data, _err, { id }) => {
      // Final reconciliation with server state. No broad estimates
      // invalidation — autosaves don't change list-shape data.
      qc.invalidateQueries({ queryKey: detailKey(id) });
    },
  });
}

export function useApproveReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => approveReview(id),
    onSuccess: (_data, id) => invalidateAfterTransition(qc, id),
  });
}

export function useRejectReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: RejectRequest }) =>
      rejectReview(id, body),
    onSuccess: (_data, { id }) => invalidateAfterTransition(qc, id),
  });
}

export function useSendBackMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SendBackRequest }) =>
      sendBack(id, body),
    onSuccess: (_data, { id }) => invalidateAfterTransition(qc, id),
  });
}
