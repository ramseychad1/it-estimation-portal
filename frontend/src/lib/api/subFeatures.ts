import { api } from "../api";
import type { TemplateFileMeta } from "./templateFiles";

export interface SubFeatureListItem {
  id: number;
  productId: number;
  name: string;
  description: string | null;
  active: boolean;
  questionCount: number;
  updatedAt: string | null;
  updatedBy: number | null;
  createdAt: string | null;
  createdBy: number | null;
}

export interface SubFeatureDetail extends SubFeatureListItem {
  templateFile: TemplateFileMeta | null;
}

export interface CreateSubFeatureRequest {
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface UpdateSubFeatureRequest {
  name?: string;
  description?: string | null;
}

export function listSubFeaturesForProduct(productId: number): Promise<SubFeatureListItem[]> {
  return api(`/catalog/products/${productId}/sub-features`);
}

export function getSubFeature(id: number): Promise<SubFeatureDetail> {
  return api(`/catalog/sub-features/${id}`);
}

export function createSubFeature(productId: number, body: CreateSubFeatureRequest): Promise<SubFeatureDetail> {
  return api(`/catalog/products/${productId}/sub-features`, { method: "POST", body });
}

export function updateSubFeature(id: number, body: UpdateSubFeatureRequest): Promise<SubFeatureDetail> {
  return api(`/catalog/sub-features/${id}`, { method: "PATCH", body });
}

export function activateSubFeature(id: number): Promise<SubFeatureDetail> {
  return api(`/catalog/sub-features/${id}/activate`, { method: "POST" });
}

export function deactivateSubFeature(id: number): Promise<SubFeatureDetail> {
  return api(`/catalog/sub-features/${id}/deactivate`, { method: "POST" });
}

export function deleteSubFeature(id: number, confirmationName: string): Promise<void> {
  return api(`/catalog/sub-features/${id}`, {
    method: "DELETE",
    body: { confirmationName },
  });
}
