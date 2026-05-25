import { CopyToClipboardButton } from "../../components/CopyToClipboardButton";
import { PrimaryButton, SecondaryButton } from "../../components/buttons";
import { useSendInvitationEmailMutation } from "../../lib/queries/users";
import { useToast } from "../../components/Toast";
import { ApiError } from "../../lib/api";

interface InviteCreatedModalProps {
  open: boolean;
  userId: number;
  email: string;
  inviteUrl: string;
  onDone: () => void;
}

export function InviteCreatedModal({ open, userId, email, inviteUrl, onDone }: InviteCreatedModalProps) {
  const toast = useToast();
  const sendEmailMutation = useSendInvitationEmailMutation();

  if (!open) return null;

  async function handleSendEmail() {
    try {
      await sendEmailMutation.mutateAsync(userId);
      toast.success(`Invitation email sent to ${email}.`);
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body as { message?: string })?.message ?? "" : "";
      toast.error(msg || "Failed to send invitation email. Check your SMTP configuration in Global Settings.");
    }
  }

  return (
    <>
      <div
        onClick={onDone}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(39,37,31,0.40)" }}
      />
      <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none" style={{ paddingTop: 96 }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invite created"
          className="bg-white rounded-lg overflow-hidden flex flex-col pointer-events-auto"
          style={{ width: 560, boxShadow: "var(--shadow-modal)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <header style={{ padding: "20px 24px 12px" }}>
            <div
              className="font-semibold text-near-black"
              style={{ fontSize: 18, letterSpacing: "-0.005em" }}
            >
              Invite created
            </div>
          </header>
          <div className="text-near-black" style={{ padding: "0 24px 20px", fontSize: 14, lineHeight: "20px" }}>
            <p className="m-0 text-warm-gray-med">
              Send the invite link to{" "}
              <strong className="text-near-black">{email}</strong> by email, or copy it to share
              manually.
            </p>
            <div
              className="flex items-center gap-2 mt-4"
              style={{
                background: "var(--color-warm-gray-light)",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              <code
                className="font-mono text-near-black flex-1 truncate"
                style={{ fontSize: 12, lineHeight: "16px" }}
              >
                {inviteUrl}
              </code>
              <CopyToClipboardButton value={inviteUrl} ariaLabel="Copy invite link" />
            </div>
          </div>
          <footer
            className="flex items-center justify-between"
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--color-warm-gray-light)",
              background: "#FBFBFA",
            }}
          >
            <SecondaryButton
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending}
            >
              {sendEmailMutation.isPending ? "Sending…" : "Send Email Invite"}
            </SecondaryButton>
            <PrimaryButton onClick={onDone}>Done</PrimaryButton>
          </footer>
        </div>
      </div>
    </>
  );
}
