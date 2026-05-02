import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDraft,
  discardDraft,
  getMyRequest,
  listMyRequestHistory,
  listMyRequests,
  saveDraftAnswers,
  submitRequest,
  updateDraft,
  type CreateDraftRequest,
  type ListMyRequestsParams,
  type SaveAnswersRequest,
  type UpdateDraftRequest,
} from "../api/estimates";

const ESTIMATES_KEY = ["estimates"] as const;

export function useMyRequestsQuery(params: ListMyRequestsParams) {
  return useQuery({
    queryKey: [...ESTIMATES_KEY, "my", params],
    queryFn: () => listMyRequests(params),
  });
}

export function useMyRequestQuery(id: number | null) {
  return useQuery({
    queryKey: [...ESTIMATES_KEY, "my", "detail", id ?? -1],
    queryFn: () => getMyRequest(id as number),
    enabled: id != null,
  });
}

export function useMyRequestHistoryQuery(id: number | null) {
  return useQuery({
    queryKey: [...ESTIMATES_KEY, "my", "history", id ?? -1],
    queryFn: () => listMyRequestHistory(id as number),
    enabled: id != null,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ESTIMATES_KEY });
}

function invalidateDetail(qc: ReturnType<typeof useQueryClient>, id: number) {
  qc.invalidateQueries({ queryKey: [...ESTIMATES_KEY, "my", "detail", id] });
  // List queries depend on status changes too; invalidate them broadly so
  // any open list with a matching status filter refetches.
  qc.invalidateQueries({ queryKey: [...ESTIMATES_KEY, "my"] });
}

export function useCreateDraftMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDraftRequest) => createDraft(body),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateDraftMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateDraftRequest }) =>
      updateDraft(id, body),
    onSuccess: (_data, { id }) => invalidateDetail(qc, id),
  });
}

export function useDiscardDraftMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => discardDraft(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSaveDraftAnswersMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SaveAnswersRequest }) =>
      saveDraftAnswers(id, body),
    onSuccess: (_data, { id }) => invalidateDetail(qc, id),
  });
}

export function useSubmitRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => submitRequest(id),
    // Submit changes status — invalidate the whole tree so open lists,
    // detail views, and (Phase 6b) the SO review queue all refresh.
    onSuccess: () => invalidateAll(qc),
  });
}
