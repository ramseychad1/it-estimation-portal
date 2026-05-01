import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateQuestion,
  createProductQuestion,
  createSubFeatureQuestion,
  deactivateQuestion,
  deleteQuestion,
  getQuestion,
  listAllQuestions,
  listProductQuestions,
  listSubFeatureQuestions,
  reorderProductQuestions,
  reorderSubFeatureQuestions,
  updateQuestion,
  type CreateQuestionRequest,
  type ListQuestionsParams,
  type UpdateQuestionRequest,
} from "../api/questions";

const QUESTIONS_KEY = ["questions"] as const;
const PRODUCTS_KEY = ["products"] as const;
const SUB_FEATURES_KEY = ["sub-features"] as const;

export function useProductQuestionsQuery(productId: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, productId ?? -1, "questions"],
    queryFn: () => listProductQuestions(productId as number),
    enabled: productId != null,
  });
}

export function useSubFeatureQuestionsQuery(subFeatureId: number | null) {
  return useQuery({
    queryKey: [...SUB_FEATURES_KEY, subFeatureId ?? -1, "questions"],
    queryFn: () => listSubFeatureQuestions(subFeatureId as number),
    enabled: subFeatureId != null,
  });
}

export function useAllQuestionsQuery(params: ListQuestionsParams) {
  return useQuery({
    queryKey: [...QUESTIONS_KEY, "list", params],
    queryFn: () => listAllQuestions(params),
    placeholderData: keepPreviousData,
  });
}

export function useQuestionQuery(id: number | null) {
  return useQuery({
    queryKey: [...QUESTIONS_KEY, "detail", id ?? -1],
    queryFn: () => getQuestion(id as number),
    enabled: id != null,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUESTIONS_KEY });
  // Counts surface on Product / SubFeature list items, so bump both.
  qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
  qc.invalidateQueries({ queryKey: SUB_FEATURES_KEY });
}

export function useCreateProductQuestionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, body }: { productId: number; body: CreateQuestionRequest }) =>
      createProductQuestion(productId, body),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateSubFeatureQuestionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subFeatureId, body }: { subFeatureId: number; body: CreateQuestionRequest }) =>
      createSubFeatureQuestion(subFeatureId, body),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateQuestionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateQuestionRequest }) => updateQuestion(id, body),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useActivateQuestionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activateQuestion(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeactivateQuestionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deactivateQuestion(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteQuestionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteQuestion(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useReorderProductQuestionsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, questionIds }: { productId: number; questionIds: number[] }) =>
      reorderProductQuestions(productId, questionIds),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useReorderSubFeatureQuestionsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subFeatureId, questionIds }: { subFeatureId: number; questionIds: number[] }) =>
      reorderSubFeatureQuestions(subFeatureId, questionIds),
    onSuccess: () => invalidateAll(qc),
  });
}
