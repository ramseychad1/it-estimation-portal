import { api } from "../api";
import type { PageResponse } from "./users";

export type QuestionParentType = "Product" | "SubFeature";

export interface QuestionListItem {
  id: number;
  parentType: QuestionParentType;
  parentId: number;
  parentName: string;
  grandparentProductId: number | null;
  grandparentProductName: string | null;
  questionText: string;
  helpText: string | null;
  required: boolean;
  displayOrder: number;
  active: boolean;
  updatedAt: string | null;
  updatedBy: number | null;
  createdAt: string | null;
  createdBy: number | null;
}

export interface QuestionDetail extends QuestionListItem {}

export interface CreateQuestionRequest {
  questionText: string;
  helpText?: string | null;
  required?: boolean;
  active?: boolean;
}

export interface UpdateQuestionRequest {
  questionText?: string;
  helpText?: string | null;
  required?: boolean;
}

export interface ListQuestionsParams {
  search?: string;
  parentType?: QuestionParentType;
  required?: "ALL" | "REQUIRED" | "OPTIONAL";
  status?: "ALL" | "ACTIVE" | "INACTIVE";
  page?: number;
  size?: number;
  sort?: string;
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

// ---- in-context routes (list / create / reorder under a parent) -----------

export function listProductQuestions(productId: number): Promise<QuestionListItem[]> {
  return api(`/catalog/products/${productId}/questions`);
}

export function listSubFeatureQuestions(subFeatureId: number): Promise<QuestionListItem[]> {
  return api(`/catalog/sub-features/${subFeatureId}/questions`);
}

export function createProductQuestion(productId: number, body: CreateQuestionRequest): Promise<QuestionDetail> {
  return api(`/catalog/products/${productId}/questions`, { method: "POST", body });
}

export function createSubFeatureQuestion(subFeatureId: number, body: CreateQuestionRequest): Promise<QuestionDetail> {
  return api(`/catalog/sub-features/${subFeatureId}/questions`, { method: "POST", body });
}

export function reorderProductQuestions(productId: number, questionIds: number[]): Promise<QuestionListItem[]> {
  return api(`/catalog/products/${productId}/questions/reorder`, {
    method: "PATCH",
    body: { questionIds },
  });
}

export function reorderSubFeatureQuestions(subFeatureId: number, questionIds: number[]): Promise<QuestionListItem[]> {
  return api(`/catalog/sub-features/${subFeatureId}/questions/reorder`, {
    method: "PATCH",
    body: { questionIds },
  });
}

// ---- cross-catalog browser + direct CRUD ----------------------------------

export function listAllQuestions(params: ListQuestionsParams = {}): Promise<PageResponse<QuestionListItem>> {
  return api(`/catalog/questions${toQuery(params as Record<string, unknown>)}`);
}

export function getQuestion(id: number): Promise<QuestionDetail> {
  return api(`/catalog/questions/${id}`);
}

export function updateQuestion(id: number, body: UpdateQuestionRequest): Promise<QuestionDetail> {
  return api(`/catalog/questions/${id}`, { method: "PATCH", body });
}

export function activateQuestion(id: number): Promise<QuestionDetail> {
  return api(`/catalog/questions/${id}/activate`, { method: "POST" });
}

export function deactivateQuestion(id: number): Promise<QuestionDetail> {
  return api(`/catalog/questions/${id}/deactivate`, { method: "POST" });
}

export function deleteQuestion(id: number): Promise<void> {
  return api(`/catalog/questions/${id}`, { method: "DELETE" });
}
