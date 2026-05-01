import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { BrandMark } from "../components/BrandMark";
import { PrimaryButton } from "../components/buttons";
import { TextInput } from "../components/inputs";

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as LocationState | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Sign in — Estimator";
  }, []);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={fromPath} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate(fromPath, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError("Could not sign in. Try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-warm-gray-light px-6">
      <div
        className="w-full max-w-sm bg-white rounded-lg p-8"
        style={{
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <BrandMark />
          <span className="text-near-black font-semibold" style={{ fontSize: 16, letterSpacing: "-0.005em" }}>
            Estimator
          </span>
        </div>

        <h1 className="text-section-title font-semibold text-near-black m-0 mb-1">Sign in</h1>
        <p className="text-body text-warm-gray-med mb-5">
          Use your work email and password.
        </p>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <TextInput
            type="email"
            name="email"
            label="Email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <TextInput
            type="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          {error && (
            <p className="text-small text-cardinal-red" role="alert">
              {error}
            </p>
          )}
          <PrimaryButton type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </PrimaryButton>
        </form>
      </div>
    </main>
  );
}
