import { api } from "../api";
import type { EstimateRequestDetail, EstimateRequestListItem } from "./estimates";
import type { PageResponse } from "./users";

export type PricingModel = "TARGET_MARGIN" | "TIME_AND_MATERIALS";

export interface RmItemOverrideInput {
  itemId: number;
  pricingModel: PricingModel | null;
  tmMultiplier: number | null;
  tmTargetMarginPct: number | null;
  matBillableRate: number | null;
  matDiscountPct: number | null;
}

export interface SavePricingReviewRequest {
  discountPct: number | null;
  notes: string | null;
  itemOverrides: RmItemOverrideInput[];
}

export function getPricingReviewQueue(
  page = 0,
  size = 25,
): Promise<PageResponse<EstimateRequestListItem>> {
  return api<PageResponse<EstimateRequestListItem>>(
    `/pricing-review?page=${page}&size=${size}`,
  );
}

export function getPricingReviewDetail(id: number): Promise<EstimateRequestDetail> {
  return api<EstimateRequestDetail>(`/pricing-review/${id}`);
}

export function claimPricingReview(id: number): Promise<EstimateRequestDetail> {
  return api<EstimateRequestDetail>(`/pricing-review/${id}/claim`, {
    method: "POST",
  });
}

export function releasePricingReview(id: number): Promise<EstimateRequestDetail> {
  return api<EstimateRequestDetail>(`/pricing-review/${id}/release`, {
    method: "POST",
  });
}

export function savePricingReview(
  id: number,
  body: SavePricingReviewRequest,
): Promise<EstimateRequestDetail> {
  return api<EstimateRequestDetail>(`/pricing-review/${id}/save`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function approvePricingReview(
  id: number,
  body: SavePricingReviewRequest,
): Promise<EstimateRequestDetail> {
  return api<EstimateRequestDetail>(`/pricing-review/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAppSettings(): Promise<Record<string, string>> {
  return api<Record<string, string>>("/admin/settings");
}

export function updateAppSettings(
  updates: Record<string, string>,
): Promise<Record<string, string>> {
  return api<Record<string, string>>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export function sendTestEmail(toAddress: string): Promise<void> {
  return api<void>("/admin/settings/test-email", {
    method: "POST",
    body: JSON.stringify({ toAddress }),
  });
}
