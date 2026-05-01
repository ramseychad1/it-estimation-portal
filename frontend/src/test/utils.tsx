import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, type RenderOptions } from "@testing-library/react";
import { AuthProvider } from "../lib/auth";

interface ProvidersOptions {
  initialEntries?: string[];
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function Providers({
  children,
  initialEntries = ["/"],
  client,
}: ProvidersOptions & { children: ReactNode; client?: QueryClient }) {
  const queryClient = client ?? makeQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProvidersOptions & RenderOptions & { client?: QueryClient } = {},
) {
  const { initialEntries, client, ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers initialEntries={initialEntries} client={client}>
        {children}
      </Providers>
    ),
    ...renderOptions,
  });
}
