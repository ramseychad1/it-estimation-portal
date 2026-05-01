import { useQuery } from "@tanstack/react-query";
import { api } from "./lib/api";

interface HealthResponse {
  status: string;
}

export default function App() {
  const { data, isLoading, error } = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: () => api<HealthResponse>("/health"),
  });

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <header className="mb-6">
          <h1 className="text-page-title font-semibold text-near-black">
            Estimator
          </h1>
          <p className="text-body text-warm-gray-med mt-2">
            Phase 0 scaffolding — verifying the stack runs end to end.
          </p>
        </header>

        <section
          className="rounded-lg border border-border bg-white p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="text-section-title font-semibold text-near-black mb-3">
            Backend health
          </h2>
          {isLoading && (
            <p className="text-body text-warm-gray-med">Loading…</p>
          )}
          {error instanceof Error && (
            <p className="text-body text-cardinal-red">
              Could not reach /api/health — {error.message}
            </p>
          )}
          {data && (
            <pre className="text-body text-near-black bg-warm-gray-light rounded-md p-3 font-mono overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </main>
  );
}
