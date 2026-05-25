import { useEffect, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { Toggle } from "../../components/Toggle";
import {
  useAppSettingsQuery,
  useSendTestEmailMutation,
  useUpdateAppSettingsMutation,
} from "../../lib/queries/pricingReview";
import { useToast } from "../../components/Toast";

export function GlobalSettingsPage() {
  useEffect(() => {
    document.title = "Global Settings — Estimator";
  }, []);

  const toast = useToast();
  const settingsQuery = useAppSettingsQuery();
  const updateMutation = useUpdateAppSettingsMutation();
  const testEmailMutation = useSendTestEmailMutation();

  const settings = settingsQuery.data ?? {};
  const revenueReviewEnabled = settings["revenue_review_enabled"] === "true";
  const emailEnabled = settings["email_enabled"] === "true";

  // SMTP local form state — populated once settings load
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [smtpPopulated, setSmtpPopulated] = useState(false);

  // Populate form from loaded settings (once only)
  useEffect(() => {
    if (settingsQuery.data && !smtpPopulated) {
      setSmtpHost(settingsQuery.data["email_smtp_host"] ?? "smtp.gmail.com");
      setSmtpPort(settingsQuery.data["email_smtp_port"] ?? "587");
      setSmtpUsername(settingsQuery.data["email_smtp_username"] ?? "");
      setFromName(settingsQuery.data["email_from_name"] ?? "IT Estimation Portal");
      setFromAddress(settingsQuery.data["email_from_address"] ?? "");
      setSmtpPopulated(true);
    }
  }, [settingsQuery.data, smtpPopulated]);

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

  function handleSaveSmtp() {
    const updates: Record<string, string> = {
      email_smtp_host: smtpHost,
      email_smtp_port: smtpPort,
      email_smtp_username: smtpUsername,
      email_from_name: fromName,
      email_from_address: fromAddress,
    };
    if (passwordDirty) {
      updates["email_smtp_password"] = smtpPassword;
    }
    updateMutation.mutate(updates, {
      onSuccess: () => {
        toast.success("SMTP settings saved.");
        setPasswordDirty(false);
        setSmtpPassword("");
      },
      onError: () => toast.error("Failed to save SMTP settings."),
    });
  }

  function handleSendTestEmail() {
    if (!testEmailAddress.trim()) return;
    testEmailMutation.mutate(testEmailAddress.trim(), {
      onSuccess: () => {
        toast.success(`Test email sent to ${testEmailAddress}.`);
        setTestEmailAddress("");
        setShowTestEmailInput(false);
      },
      onError: () =>
        toast.error("Failed to send test email. Check your SMTP configuration."),
    });
  }

  const smtpBusy = settingsQuery.isLoading || updateMutation.isPending;

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
              disabled={settingsQuery.isLoading || updateMutation.isPending}
              label="Toggle Email Notifications"
            />
          </SettingRow>

          {/* SMTP config card */}
          <div
            style={{
              marginTop: 24,
              padding: "20px 24px",
              border: "1px solid var(--color-warm-gray-light)",
              borderRadius: 8,
              background: "var(--color-surface, #fafaf9)",
            }}
          >
            <div
              className="font-semibold text-near-black"
              style={{ fontSize: 13, marginBottom: 16 }}
            >
              SMTP Configuration
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
              <SmtpField
                label="Host"
                value={smtpHost}
                onChange={setSmtpHost}
                placeholder="smtp.gmail.com"
                disabled={smtpBusy}
              />
              <SmtpField
                label="Port"
                value={smtpPort}
                onChange={setSmtpPort}
                placeholder="587"
                inputMode="numeric"
                disabled={smtpBusy}
              />
              <SmtpField
                label="Username"
                value={smtpUsername}
                onChange={setSmtpUsername}
                placeholder="you@gmail.com"
                disabled={smtpBusy}
                style={{ gridColumn: "1 / -1" }}
              />
              <SmtpField
                label="Password / App Password"
                value={smtpPassword}
                onChange={(v) => { setSmtpPassword(v); setPasswordDirty(true); }}
                placeholder="Leave blank to keep existing password"
                type="password"
                disabled={smtpBusy}
                style={{ gridColumn: "1 / -1" }}
              />
              <SmtpField
                label="From Name"
                value={fromName}
                onChange={setFromName}
                placeholder="IT Estimation Portal"
                disabled={smtpBusy}
              />
              <SmtpField
                label='From Address ("Send mail as" alias)'
                value={fromAddress}
                onChange={setFromAddress}
                placeholder="Leave blank to use Username"
                disabled={smtpBusy}
              />
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={handleSaveSmtp}
                disabled={smtpBusy}
                className="font-medium"
                style={{
                  padding: "7px 16px",
                  background: "var(--color-near-black, #1a1a1a)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: smtpBusy ? "not-allowed" : "pointer",
                  opacity: smtpBusy ? 0.6 : 1,
                }}
              >
                {updateMutation.isPending ? "Saving…" : "Save SMTP Settings"}
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
                    className="font-medium"
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

            <p
              className="text-warm-gray-med"
              style={{ fontSize: 12, marginTop: 12, lineHeight: 1.5 }}
            >
              Use a Gmail <strong>App Password</strong> (not your regular password) — generate one
              at{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                myaccount.google.com/apppasswords
              </a>
              . The <em>From Address</em> field supports Gmail{" "}
              <strong>&ldquo;Send mail as&rdquo;</strong> verified aliases — leave it blank to
              send from your Username address.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start justify-between gap-6"
      style={{
        padding: "16px 0",
        borderBottom: "1px solid var(--color-warm-gray-light)",
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="font-medium text-near-black" style={{ fontSize: 14 }}>
          {label}
        </div>
        <div className="text-warm-gray-med" style={{ fontSize: 13, marginTop: 4 }}>
          {description}
        </div>
      </div>
      <div className="flex-none" style={{ paddingTop: 2 }}>
        {children}
      </div>
    </div>
  );
}

function SmtpField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  disabled,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label
        className="text-near-black"
        style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 4 }}
      >
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
