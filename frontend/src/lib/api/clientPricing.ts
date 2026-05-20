import { api } from "../api";

export type PricingModel = "TARGET_MARGIN" | "TIME_AND_MATERIALS";

export interface ClientPricingDefaultsDto {
  id: number;
  tmMultiplier: number | null;
  tmTargetMarginPct: number | null;
  matBillableRate: number | null;
  matDiscountPct: number | null;
  updatedAt: string | null;
}

export interface CategoryPricingConfigDto {
  categoryId: number;
  categoryName: string;
  categoryActive: boolean;
  pricingModel: PricingModel | null;
  overrideTmMultiplier: number | null;
  overrideTmTargetMarginPct: number | null;
  overrideMatBillableRate: number | null;
  overrideMatDiscountPct: number | null;
}

export interface UpdateDefaultsRequest {
  tmMultiplier: number | null;
  tmTargetMarginPct: number | null;
  matBillableRate: number | null;
  matDiscountPct: number | null;
}

export interface UpdateCategoryPricingRequest {
  pricingModel: PricingModel | null;
  overrideTmMultiplier: number | null;
  overrideTmTargetMarginPct: number | null;
  overrideMatBillableRate: number | null;
  overrideMatDiscountPct: number | null;
}

/** Effective pricing for a category: category override merged with global defaults. */
export interface EffectiveCategoryPricingDto {
  pricingModel: PricingModel | null;
  tmMultiplier: number | null;
  tmTargetMarginPct: number | null;
  matBillableRate: number | null;
  matDiscountPct: number | null;
}

export function getClientPricingDefaults(): Promise<ClientPricingDefaultsDto> {
  return api(`/admin/client-pricing/defaults`);
}

export function updateClientPricingDefaults(
  body: UpdateDefaultsRequest
): Promise<ClientPricingDefaultsDto> {
  return api(`/admin/client-pricing/defaults`, { method: "PUT", body });
}

export function listCategoryPricingConfigs(): Promise<CategoryPricingConfigDto[]> {
  return api(`/admin/client-pricing/categories`);
}

export function updateCategoryPricing(
  categoryId: number,
  body: UpdateCategoryPricingRequest
): Promise<CategoryPricingConfigDto> {
  return api(`/admin/client-pricing/categories/${categoryId}`, { method: "PATCH", body });
}

export function getEffectiveCategoryPricing(
  categoryId: number
): Promise<EffectiveCategoryPricingDto> {
  return api(`/admin/client-pricing/categories/${categoryId}/effective`);
}
