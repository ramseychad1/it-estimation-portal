import { useQuery } from "@tanstack/react-query";
import { getTeamWorkloadDetail, getTeamWorkloadSummary } from "../api/reporting";

const REPORTING_KEY = ["reporting"] as const;

export function useTeamWorkloadSummaryQuery() {
  return useQuery({
    queryKey: [...REPORTING_KEY, "team-workload"],
    queryFn: getTeamWorkloadSummary,
    staleTime: 60_000,
  });
}

export function useTeamWorkloadDetailQuery(teamId: number | null) {
  return useQuery({
    queryKey: [...REPORTING_KEY, "team-workload", teamId],
    queryFn: () => getTeamWorkloadDetail(teamId as number),
    enabled: teamId !== null,
    staleTime: 60_000,
  });
}
