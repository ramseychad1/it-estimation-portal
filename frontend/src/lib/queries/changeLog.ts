import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getChangeLogFilterOptions,
  listChangeLog,
  type ListChangeLogParams,
} from "../api/changeLog";

const CHANGE_LOG_KEY = ["change-log"] as const;

export function useChangeLogQuery(params: ListChangeLogParams) {
  return useQuery({
    queryKey: [...CHANGE_LOG_KEY, "list", params],
    queryFn: () => listChangeLog(params),
    // Filters change frequently as the user types/clicks; keep the previous
    // page on screen during the round-trip so the feed doesn't flash empty.
    placeholderData: keepPreviousData,
  });
}

export function useChangeLogFilterOptionsQuery() {
  return useQuery({
    queryKey: [...CHANGE_LOG_KEY, "filters"],
    queryFn: getChangeLogFilterOptions,
    staleTime: 60_000,
  });
}
