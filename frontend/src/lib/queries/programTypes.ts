import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProgramType,
  deleteProgramType,
  listActiveProgramTypes,
  listAllProgramTypes,
  updateProgramType,
  type ProgramTypeRequest,
} from "../api/programTypes";

const PT_KEY = ["programTypes"] as const;

export function useActiveProgramTypesQuery() {
  return useQuery({
    queryKey: [...PT_KEY, "active"],
    queryFn: listActiveProgramTypes,
  });
}

export function useAllProgramTypesQuery() {
  return useQuery({
    queryKey: [...PT_KEY, "all"],
    queryFn: listAllProgramTypes,
  });
}

function invalidateProgramTypes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: PT_KEY });
}

export function useCreateProgramTypeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProgramTypeRequest) => createProgramType(body),
    onSuccess: () => invalidateProgramTypes(qc),
  });
}

export function useUpdateProgramTypeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ProgramTypeRequest }) =>
      updateProgramType(id, body),
    onSuccess: () => invalidateProgramTypes(qc),
  });
}

export function useDeleteProgramTypeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteProgramType(id),
    onSuccess: () => invalidateProgramTypes(qc),
  });
}
