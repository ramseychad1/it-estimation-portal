import { api } from "../api";

export interface TemplateLineView {
  sdlcPhaseId: number;
  sdlcPhaseName: string;
  sdlcPhaseDisplayOrder: number;
  sdlcPhaseActive: boolean;
  onshoreLow: number;
  onshoreMed: number;
  onshoreHigh: number;
  offshoreLow: number;
  offshoreMed: number;
  offshoreHigh: number;
}

export interface TemplateView {
  id: number;
  productId: number | null;
  subFeatureId: number | null;
  versionNumber: number;
  active: boolean;
  changeReason: string | null;
  createdAt: string | null;
  createdBy: number | null;
  displayName: string;
  lines: TemplateLineView[];
}

export interface CreateTemplateRequest {
  changeReason?: string | null;
}

export interface SaveTemplateLineInput {
  sdlcPhaseId: number;
  onshoreLow: number;
  onshoreMed: number;
  onshoreHigh: number;
  offshoreLow: number;
  offshoreMed: number;
  offshoreHigh: number;
}

export interface SaveTemplateVersionRequest {
  lines: SaveTemplateLineInput[];
  changeReason?: string | null;
}

export function getProductTemplate(productId: number): Promise<TemplateView | null> {
  return api(`/catalog/products/${productId}/template`);
}

export function getSubFeatureTemplate(subFeatureId: number): Promise<TemplateView | null> {
  return api(`/catalog/sub-features/${subFeatureId}/template`);
}

export function createProductTemplate(
  productId: number,
  body: CreateTemplateRequest = {},
): Promise<TemplateView> {
  return api(`/catalog/products/${productId}/template`, { method: "POST", body });
}

export function createSubFeatureTemplate(
  subFeatureId: number,
  body: CreateTemplateRequest = {},
): Promise<TemplateView> {
  return api(`/catalog/sub-features/${subFeatureId}/template`, { method: "POST", body });
}

export function saveProductTemplate(
  productId: number,
  body: SaveTemplateVersionRequest,
): Promise<TemplateView> {
  return api(`/catalog/products/${productId}/template`, { method: "PUT", body });
}

export function saveSubFeatureTemplate(
  subFeatureId: number,
  body: SaveTemplateVersionRequest,
): Promise<TemplateView> {
  return api(`/catalog/sub-features/${subFeatureId}/template`, { method: "PUT", body });
}
