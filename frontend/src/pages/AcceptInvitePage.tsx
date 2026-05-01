import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, primeCsrfToken } from "../lib/api";
import {
  useAcceptInvitationMutation,
  useValidateInvitationTokenQuery,
} from "../lib/queries/users";
import { useToast } from "../components/Toast";
import { BrandMark } from "../components/BrandMark";
import { TextInput } from "../components/inputs";
import { PrimaryButton } from "../components/buttons";

interface PasswordRules {
  longEnough: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
}

function checkPassword(pw: string): PasswordRules {
  return {
    longEnough: pw.length >= 8,
    hasLetter: /[A-Za-z]/.test(pw),
    hasDigit: /\d/.test(pw),
  };
}

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  // Prime CSRF cookie before the POST.
  useEffect(() => { void primeCsrfToken(); }, []);

  useEffect(() => { document.title = "Accept invitation — Estimator"; }, []);

  const tokenQuery = useValidateInvitationTokenQuery(token ?? null);
  const acceptMutation = useAcceptInvitationMutation();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const rules = useMemo(() => checkPassword(password), [password]);
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit =
    rules.longEnough && rules.hasLetter && rules.hasDigit && passwordsMatch && !!token;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !token) return;
    setServerError(null);
    try {
      await acceptMutation.mutateAsync({ token, password });
      toast.success("Invitation accepted. Please sign in.");
      navigate("/login", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { message?: string };
        setServerError(body?.message ?? "Could not accept the invitation.");
      } else {
        setServerError("Could not accept the invitation.");
      }
    }
  }

  // ---- invalid-token panel -------------------------------------------

  if (tokenQuery.isError || (tokenQuery.data && !tokenQuery.data.valid)) {
    return (
      <CenterPanel>
        <div className="flex items-center gap-2.5 mb-4">
          <BrandMark />
          <span className="text-near-black font-semibold" style={{ fontSize: 16 }}>
            Estimator
          </span>
        </div>
        <h1 className="text-section-title font-semibold text-near-black m-0 mb-1">
          This invitation isn't valid
        </h1>
        <p className="text-body text-warm-gray-med mt-2">
          Invitation links expire after a few weeks and can also be revoked or already used. Reach out to the person who invited you for a fresh link.
        </p>
        <Link
          to="/login"
          className="inline-block mt-5 text-near-black font-medium hover:underline"
          style={{ fontSize: 13 }}
        >
          Return to sign in →
        </Link>
      </CenterPanel>
    );
  }

  if (tokenQuery.isLoading || !tokenQuery.data) {
    return (
      <CenterPanel>
        <p className="text-warm-gray-med">Checking invitation…</p>
      </CenterPanel>
    );
  }

  // ---- valid form -----------------------------------------------------
  return (
    <CenterPanel>
      <div className="flex items-center gap-2.5 mb-5">
        <BrandMark />
        <span className="text-near-black font-semibold" style={{ fontSize: 16 }}>
          Estimator
        </span>
      </div>
      <h1 className="text-section-title font-semibold text-near-black m-0 mb-1">
        Set your password
      </h1>
      <p className="text-body text-warm-gray-med mb-5">
        Welcome. Set a password to finish creating your account.
      </p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <TextInput
          label="Email"
          type="email"
          value={tokenQuery.data.email ?? ""}
          readOnly
          disabled
        />
        <TextInput
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          helper="At least 8 characters, with one letter and one digit."
        />
        <ul className="m-0 p-0 mt-1 flex flex-col gap-1" style={{ listStyle: "none" }}>
          <Hint ok={rules.longEnough}>At least 8 characters</Hint>
          <Hint ok={rules.hasLetter}>Contains a letter</Hint>
          <Hint ok={rules.hasDigit}>Contains a digit</Hint>
        </ul>
        <TextInput
          label="Confirm password"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={confirm.length > 0 && !passwordsMatch ? "Passwords do not match." : undefined}
        />

        {serverError && (
          <p className="text-small text-cardinal-red" role="alert">{serverError}</p>
        )}

        <PrimaryButton type="submit" disabled={!canSubmit || acceptMutation.isPending} className="mt-2 w-full">
          {acceptMutation.isPending ? "Setting password…" : "Set password and sign in"}
        </PrimaryButton>
      </form>
    </CenterPanel>
  );
}

function CenterPanel({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-warm-gray-light px-6">
      <div
        className="w-full max-w-sm bg-white rounded-lg p-8"
        style={{
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {children}
      </div>
    </main>
  );
}

function Hint({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      className="flex items-center gap-2"
      style={{ fontSize: 12, color: ok ? "var(--color-success)" : "var(--fg-2)" }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: ok ? "var(--color-success)" : "var(--color-border-strong)",
        }}
      />
      {children}
    </li>
  );
}
