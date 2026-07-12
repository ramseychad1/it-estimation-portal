import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activatePhase,
  createPhase,
  deactivatePhase,
  deletePhase,
  getPhaseBenchmarks,
  listPhaseHistory,
  listPhases,
  reorderPhases,
  savePhaseBenchmarks,
  updatePhase,
  type PhaseBenchmarksUpdate,
  type PhaseStatusFilter,
  type SdlcPhaseCreateRequest,
  type SdlcPhaseListItem,
  type SdlcPhaseUpdateRequest,
} from "../api/phases";

const PHASES_KEY = ["phases"] as const;

function phasesListKey(status: PhaseStatusFilter) {
  return [...PHASES_KEY, "list", status] as const;
}

function phaseHistoryKey(id: number) {
  return [...PHASES_KEY, "history", id] as const;
}

export function usePhasesQuery(status: PhaseStatusFilter = "ALL") {
  return useQuery({
    queryKey: phasesListKey(status),
    queryFn: () => listPhases(status),
  });
}

export function usePhaseHistoryQuery(id: number | null) {
  return useQuery({
    queryKey: phaseHistoryKey(id ?? -1),
    queryFn: () => listPhaseHistory(id as number),
    enabled: id !== null,
  });
}

function invalidatePhases(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: PHASES_KEY });
}

const BENCHMARKS_KEY = [...PHASES_KEY, "benchmarks"] as const;

export function usePhaseBenchmarksQuery() {
  return useQuery({
    queryKey: BENCHMARKS_KEY,
    queryFn: getPhaseBenchmarks,
  });
}

export function useSavePhaseBenchmarksMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PhaseBenchmarksUpdate) => savePhaseBenchmarks(body),
    // Benchmark edits change phase rows too — invalidate the whole phases tree.
    onSuccess: () => invalidatePhases(qc),
  });
}

export function useCreatePhaseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SdlcPhaseCreateRequest) => createPhase(body),
    onSuccess: () => invalidatePhases(qc),
  });
}

export function useUpdatePhaseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SdlcPhaseUpdateRequest }) =>
      updatePhase(id, body),
    onSuccess: () => invalidatePhases(qc),
  });
}

export function useActivatePhaseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activatePhase(id),
    onSuccess: () => invalidatePhases(qc),
  });
}

export function useDeactivatePhaseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deactivatePhase(id),
    onSuccess: () => invalidatePhases(qc),
  });
}

export function useDeletePhaseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePhase(id),
    onSuccess: () => invalidatePhases(qc),
  });
}

/**
 * Optimistic reorder: paint the new order immediately, then call the server.
 * On failure, restore the prior list and let the page toast the error.
 *
 * The mutation always returns a `previous` snapshot in its context so the
 * page's onError handler can show a toast without computing the rollback
 * itself.
 */
export function useReorderPhasesMutation(status: PhaseStatusFilter = "ALL") {
  const qc = useQueryClient();
  const key = phasesListKey(status);
  return useMutation({
    mutationFn: (phaseIds: number[]) => reorderPhases(phaseIds),
    onMutate: async (phaseIds: number[]) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<SdlcPhaseListItem[]>(key) ?? null;
      if (previous) {
        const byId = new Map(previous.map((p) => [p.id, p]));
        const reordered: SdlcPhaseListItem[] = phaseIds
          .map((id, idx) => {
            const found = byId.get(id);
            return found ? { ...found, displayOrder: idx + 1 } : null;
          })
          .filter((p): p is SdlcPhaseListItem => p !== null);
        qc.setQueryData(key, reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => invalidatePhases(qc),
  });
}
