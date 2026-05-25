import { ApiError } from "../../lib/api";
import { useResendInvitationMutation, useSendInvitationEmailMutation } from "../../lib/queries/users";
import { useToast } from "../../components/Toast";
import { Drawer } from "../../components/Drawer";
import { CopyToClipboardButton } from "../../components/CopyToClipboardButton";
import { SecondaryButton, TertiaryButton } from "../../components/buttons";
import { UserAvatar } from "../../components/UserAvatar";
import { StatusBadge } from "../../components/StatusBadge";
import { UserCell } from "../../components/UserCell";
import { relativeTime } from "../../lib/relativeTime";
import type { UserDetail } from "../../lib/api/users";

interface PendingInviteDrawerProps {
  open: boolean;
  user: UserDetail | null;
  /** Most-recent invite URL for this user (set when the page knows it). */
  inviteUrl?: string | null;
  onClose: () => void;
  onResolved?: () => void;
  /** Triggers a confirm-revoke modal in the parent. */
  onRequestRevoke?: (user: UserDetail) => void;
}

function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function PendingInviteDrawer({
  open,
  user,
  inviteUrl,
  onClose,
  onResolved,
  onRequestRevoke,
}: PendingInviteDrawerProps) {
  const resendMutation = useResendInvitationMutation();
  const sendEmailMutation = useSendInvitationEmailMutation();
  const toast = useToast();

  if (!user) {
    return <Drawer open={open} onClose={onClose} title="Pending invitation">{null}</Drawer>;
  }

  const expired = isExpired(user.invitationExpiresAt);
  const expiresIn = user.invitationExpiresAt
    ? expired
      ? "Expired"
      : `Expires ${relativeTime(user.invitationExpiresAt)}`
    : "—";

  async function handleResend() {
    if (!user) return;
    try {
      await resendMutation.mutateAsync(user.id);
      toast.success("Invitation resent. Copy the new link.");
      onResolved?.();
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body as { message?: string })?.message ?? "" : "";
      toast.error(msg || "Could not resend the invitation.");
    }
  }

  async function handleSendEmail() {
    if (!user) return;
    try {
      await sendEmailMutation.mutateAsync(user.id);
      toast.success(`Invitation email sent to ${user.email}.`);
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body as { message?: string })?.message ?? "" : "";
      toast.error(msg || "Failed to send invitation email. Check your SMTP configuration in Global Settings.");
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Pending invite: ${user.firstName} ${user.lastName}`}
      footer={
        <>
          <div>
            {onRequestRevoke && (
              <TertiaryButton
                onClick={() => onRequestRevoke(user)}
                className="text-cardinal-red hover:text-cardinal-red"
              >
                Revoke invitation
              </TertiaryButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          </div>
        </>
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <UserAvatar firstName={user.firstName} lastName={user.lastName} size={64} asButton={false} />
        <div className="min-w-0">
          <div className="font-semibold text-near-black truncate" style={{ fontSize: 18 }}>
            {user.firstName} {user.lastName}
          </div>
          <div className="text-warm-gray-med truncate" style={{ fontSize: 13 }}>
            {user.email}
          </div>
          <div className="mt-1.5">
            <StatusBadge variant="warning">Pending invite</StatusBadge>
          </div>
        </div>
      </div>

      <hr style={{ height: 1, background: "var(--color-warm-gray-light)", border: 0 }} />

      <section className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <div
            className="text-warm-gray-med uppercase font-medium"
            style={{ fontSize: 11, letterSpacing: "0.06em" }}
          >
            Invite
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending || expired}
              className="text-near-black font-medium bg-transparent border-0 cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: 12 }}
            >
              {sendEmailMutation.isPending ? "Sending…" : "Send email"}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendMutation.isPending}
              className="text-near-black font-medium bg-transparent border-0 cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: 12 }}
            >
              {resendMutation.isPending ? "Sending…" : "Resend invite"}
            </button>
          </div>
        </div>

        <DetailRow label="Invited by">
          <UserCell userId={user.invitedBy} />
        </DetailRow>
        <DetailRow label="Invited on">
          <span style={{ fontSize: 14 }}>
            {user.invitedAt ? new Date(user.invitedAt).toLocaleString() : "—"}
          </span>
        </DetailRow>
        <DetailRow label="Expires">
          <span style={{ fontSize: 14 }}>{expiresIn}</span>
          {expired && <StatusBadge variant="danger">Expired</StatusBadge>}
        </DetailRow>
        {inviteUrl && !expired && (
          <DetailRow label="Invite link">
            <div
              className="flex items-center gap-2 mt-1 w-full"
              style={{
                background: "var(--color-warm-gray-light)",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              <code
                className="font-mono text-near-black flex-1 truncate"
                style={{ fontSize: 12, lineHeight: "16px" }}
              >
                {inviteUrl}
              </code>
              <CopyToClipboardButton value={inviteUrl} ariaLabel="Copy invite link" />
              <StatusBadge variant="active">Active</StatusBadge>
            </div>
          </DetailRow>
        )}
      </section>
    </Drawer>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1"
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--color-warm-gray-light)",
      }}
    >
      <span
        className="text-warm-gray-med uppercase font-medium"
        style={{ fontSize: 11, letterSpacing: "0.06em" }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2 text-near-black flex-wrap">{children}</div>
    </div>
  );
}
