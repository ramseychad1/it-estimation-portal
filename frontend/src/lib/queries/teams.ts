import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateTeam,
  bulkActivateTeams,
  bulkDeactivateTeams,
  bulkDeleteTeams,
  createTeam,
  deactivateTeam,
  deleteTeam,
  listTeamHistory,
  listTeams,
  updateTeam,
  type ListTeamsParams,
  type TeamCreateRequest,
  type TeamUpdateRequest,
} from "../api/teams";

const TEAMS_KEY = ["teams"] as const;

function teamsListKey(params: ListTeamsParams) {
  return [...TEAMS_KEY, "list", params] as const;
}

function teamHistoryKey(id: number) {
  return [...TEAMS_KEY, "history", id] as const;
}

export function useTeamsQuery(params: ListTeamsParams) {
  return useQuery({
    queryKey: teamsListKey(params),
    queryFn: () => listTeams(params),
  });
}

export function useTeamHistoryQuery(id: number | null) {
  return useQuery({
    queryKey: teamHistoryKey(id ?? -1),
    queryFn: () => listTeamHistory(id as number),
    enabled: id !== null,
  });
}

function invalidateTeams(qc: ReturnType<typeof useQueryClient>) {
  // Invalidate every list query — they may differ by params.
  qc.invalidateQueries({ queryKey: TEAMS_KEY });
}

export function useCreateTeamMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TeamCreateRequest) => createTeam(body),
    onSuccess: () => invalidateTeams(qc),
  });
}

export function useUpdateTeamMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TeamUpdateRequest }) =>
      updateTeam(id, body),
    onSuccess: () => invalidateTeams(qc),
  });
}

export function useActivateTeamMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activateTeam(id),
    onSuccess: () => invalidateTeams(qc),
  });
}

export function useDeactivateTeamMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deactivateTeam(id),
    onSuccess: () => invalidateTeams(qc),
  });
}

export function useDeleteTeamMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTeam(id),
    onSuccess: () => invalidateTeams(qc),
  });
}

export function useBulkActivateTeamsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => bulkActivateTeams(ids),
    onSuccess: () => invalidateTeams(qc),
  });
}

export function useBulkDeactivateTeamsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => bulkDeactivateTeams(ids),
    onSuccess: () => invalidateTeams(qc),
  });
}

export function useBulkDeleteTeamsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => bulkDeleteTeams(ids),
    onSuccess: () => invalidateTeams(qc),
  });
}
