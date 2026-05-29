import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type UpdateNotificationPrefsRequest,
} from "../api/profile";

const PROFILE_KEY = ["profile"] as const;

export function useNotificationPrefsQuery() {
  return useQuery({
    queryKey: [...PROFILE_KEY, "notifications"],
    queryFn: getNotificationPrefs,
    staleTime: 30_000,
  });
}

export function useUpdateNotificationPrefsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: UpdateNotificationPrefsRequest) => updateNotificationPrefs(req),
    onSuccess: (data) => {
      queryClient.setQueryData([...PROFILE_KEY, "notifications"], data);
    },
  });
}
