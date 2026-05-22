import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approvePricingReview,
  claimPricingReview,
  getAppSettings,
  getPricingReviewDetail,
  getPricingReviewQueue,
  releasePricingReview,
  savePricingReview,
  updateAppSettings,
  type SavePricingReviewRequest,
} from "../api/pricingReview";

const PR_KEY = ["pricing-review"] as const;
const SETTINGS_KEY = ["app-settings"] as const;
const ESTIMATES_KEY = ["estimates"] as const;

function detailKey(id: number) {
  return [...PR_KEY, "detail", id] as const;
}

export function usePricingReviewQueueQuery(page = 0, size = 25) {
  return useQuery({
    queryKey: [...PR_KEY, "queue", page, size],
    queryFn: () => getPricingReviewQueue(page, size),
  });
}

export function usePricingReviewDetailQuery(id: number | null) {
  return useQuery({
    queryKey: detailKey(id ?? -1),
    queryFn: () => getPricingReviewDetail(id as number),
    enabled: id != null,
  });
}

export function useClaimPricingReviewMutation(requestId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => claimPricingReview(requestId),
    onSuccess: (data) => {
      qc.setQueryData(detailKey(requestId), data);
      void qc.invalidateQueries({ queryKey: PR_KEY });
      void qc.invalidateQueries({ queryKey: ESTIMATES_KEY });
    },
  });
}

export function useReleasePricingReviewMutation(requestId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => releasePricingReview(requestId),
    onSuccess: (data) => {
      qc.setQueryData(detailKey(requestId), data);
      void qc.invalidateQueries({ queryKey: PR_KEY });
      void qc.invalidateQueries({ queryKey: ESTIMATES_KEY });
    },
  });
}

export function useSavePricingReviewMutation(requestId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SavePricingReviewRequest) => savePricingReview(requestId, body),
    onSuccess: (data) => {
      qc.setQueryData(detailKey(requestId), data);
    },
  });
}

export function useApprovePricingReviewMutation(requestId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SavePricingReviewRequest) => approvePricingReview(requestId, body),
    onSuccess: (data) => {
      qc.setQueryData(detailKey(requestId), data);
      void qc.invalidateQueries({ queryKey: PR_KEY });
      void qc.invalidateQueries({ queryKey: ESTIMATES_KEY });
    },
  });
}

export function useAppSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: getAppSettings,
  });
}

export function useUpdateAppSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Record<string, string>) => updateAppSettings(updates),
    onSuccess: (data) => {
      qc.setQueryData(SETTINGS_KEY, data);
    },
  });
}
