import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProgram,
  deleteProgram,
  listActivePrograms,
  listAllPrograms,
  updateProgram,
} from "../api/programs";
import type { ProgramRequest } from "../api/programs";

const PROGRAM_KEY = ["programs"] as const;

function invalidatePrograms(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: PROGRAM_KEY });
}

export function useActiveProgramsQuery(clientId?: number) {
  return useQuery({
    queryKey: [...PROGRAM_KEY, "active", clientId ?? null],
    queryFn: () => listActivePrograms(clientId),
  });
}

export function useAllProgramsQuery(clientId?: number) {
  return useQuery({
    queryKey: [...PROGRAM_KEY, "all", clientId ?? null],
    queryFn: () => listAllPrograms(clientId),
  });
}

export function useCreateProgramMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProgramRequest) => createProgram(body),
    onSuccess: () => invalidatePrograms(qc),
  });
}

export function useUpdateProgramMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ProgramRequest }) => updateProgram(id, body),
    onSuccess: () => invalidatePrograms(qc),
  });
}

export function useDeleteProgramMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteProgram(id),
    onSuccess: () => invalidatePrograms(qc),
  });
}
