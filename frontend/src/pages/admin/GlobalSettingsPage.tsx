import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { Toggle } from "../../components/Toggle";
import {
  useAppSettingsQuery,
  useSendTestEmailMutation,
  useUpdateAppSettingsMutation,
} from "../../lib/queries/pricingReview";
import { getGmailAuthorizeUrl, disconnectGmail } from "../../lib/api/pricingReview";
import { useToast } from "../../components/Toast";
import { ApiError } from "../../lib/api";

export function GlobalSettingsPage() {
  useEffect(() => {
    document.title = "Global Settings — Estimator";
  }, []);

  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsQuery = useAppSettingsQuery();
  const updateMutation = useUpdateAppSettingsMutation();
  const testEmailMutation = useSendTestEmailMutation();

  const settings = settingsQuery.data ?? {};
  const revenueReviewEnabled = settings["revenue_review_enabled"] === "true";
  const emailEnabled = settings["email_enabled"] === "true";

  // ── Provider selection ──────────────────────────────────────────────────
  const [emailProvider, setEmailProvider] = useState<"smtp" | "resend" | "gmail">("smtp");
  const [providerPopulated, setProviderPopulated] = useState(false);

  // ── Resend config ───────────────────────────────────────────────────────
  const [resendApiKey, setResendApiKey] = useState("");
  const [resendApiKeyDirty, setResendApiKeyDirty] = useState(false);

  // ── SMTP config ─────────────────────────────────────────────────────────
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [passwordDirty, setPasswordDirty] = useState(false);

  // ── Gmail OAuth config ──────────────────────────────────────────────────
  const [gmailClientId, setGmailClientId] = useState("");
  const [gmailClientSecret, setGmailClientSecret] = useState("");
  const [gmailClientSecretDirty, setGmailClientSecretDirty] = useState(false);
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState("");
  const [gmailConnecting, setGmailConnecting] = useState(false);

  // ── Shared from fields ──────────────────────────────────────────────────
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");

  const [populated, setPopulated] = useState(false);

  // Populate form from loaded settings (once only)
  useEffect(() => {
    if (settingsQuery.data && !populated) {
      const d = settingsQuery.data;
      const provider = (d["email_provider"] ?? "smtp") as "smtp" | "resend" | "gmail";
      if (!providerPopulated) {
        setEmailProvider(provider);
        setProviderPopulated(true);
      }
      setSmtpHost(d["email_smtp_host"] ?? "smtp.gmail.com");
      setSmtpPort(d["email_smtp_port"] ?? "587");
      setSmtpUsername(d["email_smtp_username"] ?? "");
      setFromName(d["email_from_name"] ?? "IT Estimation Portal");
      setFromAddress(d["email_from_address"] ?? "");
      setGmailClientId(d["email_gmail_client_id"] ?? "");
      setGmailConnectedEmail(d["email_gmail_connected_email"] ?? "");
      setPopulated(true);
    }
  }, [settingsQuery.data, populated, providerPopulated]);

  // Handle redirect back from Google OAuth consent screen
  useEffect(() => {
    const gmailParam = searchParams.get("gmail");
    if (gmailParam === "connected") {
      toast.success("GCP OAuth connected successfully.");
      settingsQuery.refetch();
      setSearchParams({}, { replace: true });
    } else if (gmailParam === "error") {
      const reason = searchParams.get("reason") ?? "unknown error";
      toast.error(`GCP OAuth connection failed: ${reason}`);
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Test email state
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [showTestEmailInput, setShowTestEmailInput] = useState(false);

  function handleToggleRevenueReview(next: boolean) {
    updateMutation.mutate(
      { revenue_review_enabled: String(next) },
      {
        onSuccess: () => {
          toast.success(
            next
              ? "Revenue & Pricing Review is now enabled."
              : "Revenue & Pricing Review has been disabled.",
          );
        },
        onError: () => toast.error("Failed to update setting."),
      },
    );
  }

  function handleToggleEmailEnabled(next: boolean) {
    updateMutation.mutate(
      { email_enabled: String(next) },
      {
        onSuccess: () => {
          toast.success(
            next ? "Email notifications enabled." : "Email notifications disabled.",
          );
        },
        onError: () => toast.error("Failed to update setting."),
      },
    );
  }

  function handleSaveEmailConfig() {
    const updates: Record<string, string> = {
      email_provider: emailProvider,
      email_from_name: fromName,
    };

    if (emailProvider === "resend") {
      updates["email_from_address"] = fromAddress;
      if (resendApiKeyDirty) updates["email_resend_api_key"] = resendApiKey;
    } else if (emailProvider === "gmail") {
      updates["email_gmail_client_id"] = gmailClientId;
      if (gmailClientSecretDirty) updates["email_gmail_client_secret"] = gmailClientSecret;
    } else {
      updates["email_from_address"] = fromAddress;
      updates["email_smtp_host"] = smtpHost;
      updates["email_smtp_port"] = smtpPort;
      updates["email_smtp_username"] = smtpUsername;
      if (passwordDirty) updates["email_smtp_password"] = smtpPassword;
    }

    updateMutation.mutate(updates, {
      onSuccess: () => {
        toast.success("Email settings saved.");
        setPasswordDirty(false);
        setSmtpPassword("");
        setResendApiKeyDirty(false);
        setResendApiKey("");
        setGmailClientSecretDirty(false);
        setGmailClientSecret("");
      },
      onError: () => toast.error("Failed to save email settings."),
    });
  }

  async function handleConnectGmail() {
    // Save client ID + secret first so the backend has them for the OAuth flow
    const saveUpdates: Record<string, string> = {
      email_provider: "gmail",
      email_from_name: fromName,
      email_gmail_client_id: gmailClientId,
    };
    if (gmailClientSecretDirty) saveUpdates["email_gmail_client_secret"] = gmailClientSecret;

    setGmailConnecting(true);
    try {
      await new Promise<void>((resolve, reject) => {
        updateMutation.mutate(saveUpdates, { onSuccess: () => resolve(), onError: reject });
      });
      const { authUrl } = await getGmailAuthorizeUrl();
      window.location.href = authUrl;
    } catch (err) {
      const msg = err instanceof ApiError
        ? (err.body as { message?: string })?.message ?? ""
        : "";
      toast.error(msg || "Failed to start GCP OAuth authorization.");
      setGmailConnecting(false);
    }
  }

  async function handleDisconnectGmail() {
    try {
      await disconnectGmail();
      setGmailConnectedEmail("");
      settingsQuery.refetch();
      toast.success("GCP OAuth account disconnected.");
    } catch {
      toast.error("Failed to disconnect GCP OAuth.");
    }
  }

  function handleSendTestEmail() {
    if (!testEmailAddress.trim()) return;
    testEmailMutation.mutate(testEmailAddress.trim(), {
      onSuccess: () => {
        toast.success(`Test email sent to ${testEmailAddress}.`);
        setTestEmailAddress("");
        setShowTestEmailInput(false);
      },
      onError: (err) => {
        const msg =
          err instanceof ApiError
            ? (err.body as { message?: string })?.message ?? ""
            : "";
        toast.error(msg || "Failed to send test email.");
      },
    });
  }

  const busy = settingsQuery.isLoading || updateMutation.isPending;

  return (
    <div>
      <PageHeader title="Global Settings" />

      <div style={{ maxWidth: 640, marginTop: 32 }}>
        {/* ── Workflow ── */}
        <section style={{ marginBottom: 40 }}>
          <h2
            className="font-semibold text-near-black"
            style={{ fontSize: 14, marginBottom: 16 }}
          >
            Workflow
          </h2>

          <SettingRow
            label="Revenue & Pricing Review"
            description="When enabled, every fully-approved estimate request is routed to a Revenue Manager for pricing review before it becomes visible to the requester as approved."
          >
            <Toggle
              checked={revenueReviewEnabled}
              onCheckedChange={handleToggleRevenueReview}
              disabled={settingsQuery.isLoading || updateMutation.isPending}
              label="Toggle Revenue & Pricing Review"
            />
          </SettingRow>
        </section>

        {/* ── Email Notifications ── */}
        <section>
          <h2
            className="font-semibold text-near-black"
            style={{ fontSize: 14, marginBottom: 16 }}
          >
            Email Notifications
          </h2>

          <SettingRow
            label="Email Notifications"
            description="When enabled, the portal sends automated emails for key estimate lifecycle events — item submitted, approved, rejected, clarification requested — and for user invitations."
          >
            <Toggle
              checked={emailEnabled}
              onCheckedChange={handleToggleEmailEnabled}
              disabled={busy}
              label="Toggle Email Notifications"
            />
          </SettingRow>

          {/* Email config card */}
          <div
            style={{
              marginTop: 24,
              border: "1px solid var(--color-warm-gray-light)",
              borderRadius: 8,
              background: "var(--color-surface, #fafaf9)",
              overflow: "hidden",
            }}
          >
            {/* Provider tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--color-warm-gray-light)",
              }}
            >
              {(["gmail", "resend", "smtp"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setEmailProvider(p)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    fontSize: 13,
                    fontWeight: emailProvider === p ? 600 : 400,
                    background: emailProvider === p ? "#fff" : "transparent",
                    border: "none",
                    borderBottom:
                      emailProvider === p
                        ? "2px solid var(--color-near-black)"
                        : "2px solid transparent",
                    cursor: "pointer",
                    color:
                      emailProvider === p
                        ? "var(--color-near-black)"
                        : "var(--color-warm-gray-med)",
                  }}
                >
                  {p === "gmail" ? "GCP OAuth (recommended)" : p === "resend" ? "Resend" : "SMTP"}
                </button>
              ))}
            </div>

            <div style={{ padding: "20px 24px" }}>
              {emailProvider === "gmail" ? (
                <GmailConfig
                  clientId={gmailClientId}
                  onClientIdChange={setGmailClientId}
                  clientSecret={gmailClientSecret}
                  onClientSecretChange={(v) => { setGmailClientSecret(v); setGmailClientSecretDirty(true); }}
                  connectedEmail={gmailConnectedEmail}
                  fromName={fromName}
                  onFromNameChange={setFromName}
                  onConnect={handleConnectGmail}
                  onDisconnect={handleDisconnectGmail}
                  connecting={gmailConnecting}
                  disabled={busy}
                />
              ) : emailProvider === "resend" ? (
                <ResendConfig
                  apiKey={resendApiKey}
                  onApiKeyChange={(v) => { setResendApiKey(v); setResendApiKeyDirty(true); }}
                  fromName={fromName}
                  onFromNameChange={setFromName}
                  fromAddress={fromAddress}
                  onFromAddressChange={setFromAddress}
                  disabled={busy}
                />
              ) : (
                <SmtpConfig
                  host={smtpHost}
                  onHostChange={setSmtpHost}
                  port={smtpPort}
                  onPortChange={setSmtpPort}
                  username={smtpUsername}
                  onUsernameChange={setSmtpUsername}
                  password={smtpPassword}
                  onPasswordChange={(v) => { setSmtpPassword(v); setPasswordDirty(true); }}
                  fromName={fromName}
                  onFromNameChange={setFromName}
                  fromAddress={fromAddress}
                  onFromAddressChange={setFromAddress}
                  disabled={busy}
                />
              )}

              {/* Save + test row — hidden for Gmail (Connect button handles the save) */}
              {emailProvider !== "gmail" && (
                <div
                  style={{
                    marginTop: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={handleSaveEmailConfig}
                    disabled={busy}
                    className="font-medium"
                    style={{
                      padding: "7px 16px",
                      background: "var(--color-near-black, #1a1a1a)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 13,
                      cursor: busy ? "not-allowed" : "pointer",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {updateMutation.isPending ? "Saving…" : "Save Settings"}
                  </button>

                  {showTestEmailInput ? (
                    <>
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendTestEmail()}
                        placeholder="Recipient address"
                        style={{
                          padding: "6px 10px",
                          border: "1px solid var(--color-warm-gray-light)",
                          borderRadius: 6,
                          fontSize: 13,
                          width: 200,
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSendTestEmail}
                        disabled={testEmailMutation.isPending || !testEmailAddress.trim()}
                        style={{
                          padding: "7px 14px",
                          background: "transparent",
                          border: "1px solid var(--color-warm-gray-light)",
                          borderRadius: 6,
                          fontSize: 13,
                          cursor: testEmailMutation.isPending ? "not-allowed" : "pointer",
                          opacity: testEmailMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        {testEmailMutation.isPending ? "Sending…" : "Send"}
                      </button>
                      <button
                        onClick={() => { setShowTestEmailInput(false); setTestEmailAddress(""); }}
                        style={{
                          padding: "7px 10px",
                          background: "transparent",
                          border: "none",
                          fontSize: 13,
                          color: "var(--color-warm-gray-med)",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowTestEmailInput(true)}
                      style={{
                        padding: "7px 14px",
                        background: "transparent",
                        border: "1px solid var(--color-warm-gray-light)",
                        borderRadius: 6,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Send Test Email
                    </button>
                  )}
                </div>
              )}

              {/* Gmail tab: Save + Test row shown separately from Connect */}
              {emailProvider === "gmail" && (
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {showTestEmailInput ? (
                    <>
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendTestEmail()}
                        placeholder="Recipient address"
                        style={{
                          padding: "6px 10px",
                          border: "1px solid var(--color-warm-gray-light)",
                          borderRadius: 6,
                          fontSize: 13,
                          width: 200,
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSendTestEmail}
                        disabled={testEmailMutation.isPending || !testEmailAddress.trim()}
                        style={{
                          padding: "7px 14px",
                          background: "transparent",
                          border: "1px solid var(--color-warm-gray-light)",
                          borderRadius: 6,
                          fontSize: 13,
                          cursor: testEmailMutation.isPending ? "not-allowed" : "pointer",
                          opacity: testEmailMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        {testEmailMutation.isPending ? "Sending…" : "Send"}
                      </button>
                      <button
                        onClick={() => { setShowTestEmailInput(false); setTestEmailAddress(""); }}
                        style={{
                          padding: "7px 10px",
                          background: "transparent",
                          border: "none",
                          fontSize: 13,
                          color: "var(--color-warm-gray-med)",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowTestEmailInput(true)}
                      disabled={!gmailConnectedEmail}
                      style={{
                        padding: "7px 14px",
                        background: "transparent",
                        border: "1px solid var(--color-warm-gray-light)",
                        borderRadius: 6,
                        fontSize: 13,
                        cursor: !gmailConnectedEmail ? "not-allowed" : "pointer",
                        opacity: !gmailConnectedEmail ? 0.4 : 1,
                      }}
                    >
                      Send Test Email
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Provider config sections ─────────────────────────────────────────────────

function GmailConfig({
  clientId, onClientIdChange,
  clientSecret, onClientSecretChange,
  connectedEmail,
  fromName, onFromNameChange,
  onConnect, onDisconnect,
  connecting, disabled,
}: {
  clientId: string; onClientIdChange: (v: string) => void;
  clientSecret: string; onClientSecretChange: (v: string) => void;
  connectedEmail: string;
  fromName: string; onFromNameChange: (v: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting: boolean;
  disabled?: boolean;
}) {
  const isConnected = !!connectedEmail;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ConfigField
        label="Client ID"
        value={clientId}
        onChange={onClientIdChange}
        placeholder="319681305866-xxxx.apps.googleusercontent.com"
        disabled={disabled}
        style={{ gridColumn: "1 / -1" }}
      />
      <ConfigField
        label="Client Secret"
        value={clientSecret}
        onChange={onClientSecretChange}
        placeholder="Leave blank to keep existing"
        type="password"
        disabled={disabled}
        style={{ gridColumn: "1 / -1" }}
      />
      <ConfigField
        label="From Name"
        value={fromName}
        onChange={onFromNameChange}
        placeholder="IT Estimation Portal"
        disabled={disabled}
      />

      {/* Connection status + action */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 6,
          background: isConnected ? "var(--color-success-bg, #f0fdf4)" : "var(--color-warn-bg, #fefce8)",
          border: `1px solid ${isConnected ? "var(--color-success-border, #bbf7d0)" : "var(--color-warn-border, #fde68a)"}`,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, flex: 1, color: isConnected ? "#166534" : "#92400e" }}>
          {isConnected ? `✓ Connected as ${connectedEmail}` : "Not connected — enter Client ID and Secret, then click Connect."}
        </span>
        {isConnected && (
          <button
            onClick={onDisconnect}
            disabled={disabled}
            style={{
              padding: "5px 12px",
              background: "transparent",
              border: "1px solid var(--color-warm-gray-light)",
              borderRadius: 6,
              fontSize: 12,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Disconnect
          </button>
        )}
        <button
          onClick={onConnect}
          disabled={disabled || connecting || !clientId.trim()}
          className="font-medium"
          style={{
            padding: "5px 14px",
            background: "var(--color-near-black, #1a1a1a)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 12,
            cursor: (disabled || connecting || !clientId.trim()) ? "not-allowed" : "pointer",
            opacity: (disabled || connecting || !clientId.trim()) ? 0.5 : 1,
          }}
        >
          {connecting ? "Redirecting…" : isConnected ? "Reconnect GCP OAuth" : "Connect GCP OAuth"}
        </button>
      </div>

      <p className="text-warm-gray-med" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
        Sends emails via Google's API using your GCP OAuth credentials — no domain purchase
        required. Clicking <strong>Connect GCP OAuth</strong> will open Google's consent screen
        in this tab. You'll be redirected back automatically.
      </p>
    </div>
  );
}

function ResendConfig({
  apiKey, onApiKeyChange,
  fromName, onFromNameChange,
  fromAddress, onFromAddressChange,
  disabled,
}: {
  apiKey: string; onApiKeyChange: (v: string) => void;
  fromName: string; onFromNameChange: (v: string) => void;
  fromAddress: string; onFromAddressChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ConfigField
        label="API Key"
        value={apiKey}
        onChange={onApiKeyChange}
        placeholder="re_xxxxxxxxxxxxxxxxxxxx  (leave blank to keep existing)"
        type="password"
        disabled={disabled}
        style={{ gridColumn: "1 / -1" }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
        <ConfigField
          label="From Name"
          value={fromName}
          onChange={onFromNameChange}
          placeholder="IT Estimation Portal"
          disabled={disabled}
        />
        <ConfigField
          label="From Address"
          value={fromAddress}
          onChange={onFromAddressChange}
          placeholder="noreply@yourdomain.com"
          disabled={disabled}
        />
      </div>
      <p className="text-warm-gray-med" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
        Get your API key from{" "}
        <a
          href="https://resend.com/api-keys"
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          resend.com/api-keys
        </a>
        . The <em>From Address</em> must be on a domain you've verified in Resend.
        Free tier: 3,000 emails/month.
      </p>
    </div>
  );
}

function SmtpConfig({
  host, onHostChange,
  port, onPortChange,
  username, onUsernameChange,
  password, onPasswordChange,
  fromName, onFromNameChange,
  fromAddress, onFromAddressChange,
  disabled,
}: {
  host: string; onHostChange: (v: string) => void;
  port: string; onPortChange: (v: string) => void;
  username: string; onUsernameChange: (v: string) => void;
  password: string; onPasswordChange: (v: string) => void;
  fromName: string; onFromNameChange: (v: string) => void;
  fromAddress: string; onFromAddressChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
      <ConfigField label="Host" value={host} onChange={onHostChange} placeholder="smtp.gmail.com" disabled={disabled} />
      <ConfigField label="Port" value={port} onChange={onPortChange} placeholder="587" inputMode="numeric" disabled={disabled} />
      <ConfigField label="Username" value={username} onChange={onUsernameChange} placeholder="you@gmail.com" disabled={disabled} style={{ gridColumn: "1 / -1" }} />
      <ConfigField
        label="Password / App Password"
        value={password}
        onChange={onPasswordChange}
        placeholder="Leave blank to keep existing password"
        type="password"
        disabled={disabled}
        style={{ gridColumn: "1 / -1" }}
      />
      <ConfigField label="From Name" value={fromName} onChange={onFromNameChange} placeholder="IT Estimation Portal" disabled={disabled} />
      <ConfigField label='From Address ("Send mail as" alias)' value={fromAddress} onChange={onFromAddressChange} placeholder="Leave blank to use Username" disabled={disabled} />
      <p className="text-warm-gray-med" style={{ fontSize: 12, lineHeight: 1.5, margin: 0, gridColumn: "1 / -1" }}>
        Use a Gmail <strong>App Password</strong> — generate one at{" "}
        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
          myaccount.google.com/apppasswords
        </a>
        . Note: Gmail SMTP may be blocked on some cloud hosting providers.
      </p>
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function SettingRow({
  label, description, children,
}: {
  label: string; description: string; children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start justify-between gap-6"
      style={{ padding: "16px 0", borderBottom: "1px solid var(--color-warm-gray-light)" }}
    >
      <div style={{ flex: 1 }}>
        <div className="font-medium text-near-black" style={{ fontSize: 14 }}>{label}</div>
        <div className="text-warm-gray-med" style={{ fontSize: 13, marginTop: 4 }}>{description}</div>
      </div>
      <div className="flex-none" style={{ paddingTop: 2 }}>{children}</div>
    </div>
  );
}

function ConfigField({
  label, value, onChange, placeholder, type = "text", inputMode, disabled, style,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  disabled?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 4, color: "var(--color-near-black)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "6px 10px",
          border: "1px solid var(--color-warm-gray-light)",
          borderRadius: 6,
          fontSize: 13,
          background: disabled ? "var(--color-warm-gray-lightest, #f5f5f4)" : "#fff",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
