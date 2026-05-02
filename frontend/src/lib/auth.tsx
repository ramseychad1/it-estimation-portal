import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "./api";
import { hasPermission } from "./permissions";
import type { CurrentUser } from "./types";

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<CurrentUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ME_KEY = ["auth", "me"] as const;

async function fetchMe(): Promise<CurrentUser | null> {
  try {
    return await api<CurrentUser>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  const signInMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return await api<CurrentUser>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
    },
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user);
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await api<void>("/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.setQueryData(ME_KEY, null);
      queryClient.removeQueries(); // drop any other authenticated cached data
    },
  });

  const signIn = useCallback(
    async (email: string, password: string) => {
      return await signInMutation.mutateAsync({ email, password });
    },
    [signInMutation],
  );

  const signOut = useCallback(async () => {
    await signOutMutation.mutateAsync();
  }, [signOutMutation]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isAuthenticated: !!meQuery.data,
      isLoading: meQuery.isLoading,
      signIn,
      signOut,
    }),
    [meQuery.data, meQuery.isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}

/**
 * Phase 7.5: delegates to {@code lib/permissions.hasPermission} so that
 * Admin satisfies every role check. The four existing call sites
 * (Sidebar / DashboardPage quick links / etc.) get the implication for
 * free without having to thread role lists through new APIs.
 *
 * <p>For the rare case where a check needs to know "is the user
 * literally an Admin" (e.g. an admin-only "Send back" button), import
 * {@code isAdmin} from {@code lib/permissions} directly.
 */
export function hasRole(user: CurrentUser | null, role: string): boolean {
  if (!user) return false;
  return hasPermission(role, user.roles);
}
