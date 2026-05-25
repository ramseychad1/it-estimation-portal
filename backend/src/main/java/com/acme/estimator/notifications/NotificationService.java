package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;
import com.acme.estimator.settings.AppSettingService;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Listens for notification events after the originating DB transaction commits,
 * then dispatches HTML emails. Running @Async means email failures never affect
 * the calling thread and the failed-email log is the only side effect.
 *
 * Per-event or per-user opt-out can be added here later (check a setting key or
 * a user preference row) without changing the event records or the publishing code.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private static final DateTimeFormatter DATE_FMT =
        DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG);

    private final EmailService email;
    private final AppSettingService settings;

    @Value("${app.base-url}")
    private String baseUrl;

    // ---- event listeners -----------------------------------------------

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ItemSubmittedEvent e) {
        if (!settings.isEmailEnabled()) return;
        for (User so : e.soRecipients()) {
            email.sendHtml(
                so.getEmail(),
                "New estimate item ready for review — " + e.productName(),
                renderItemSubmitted(so, e)
            );
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ItemApprovedEvent e) {
        if (!settings.isEmailEnabled()) return;
        email.sendHtml(
            e.requester().getEmail(),
            "Your estimate item has been approved — " + e.productName(),
            renderItemApproved(e)
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ItemRejectedEvent e) {
        if (!settings.isEmailEnabled()) return;
        email.sendHtml(
            e.requester().getEmail(),
            "Your estimate item needs revision — " + e.productName(),
            renderItemRejected(e)
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ItemNeedsClarificationEvent e) {
        if (!settings.isEmailEnabled()) return;
        email.sendHtml(
            e.requester().getEmail(),
            "Clarification requested on your estimate — " + e.productName(),
            renderItemNeedsClarification(e)
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ClarificationRespondedEvent e) {
        if (!settings.isEmailEnabled()) return;
        if (e.reviewer() == null) return;
        email.sendHtml(
            e.reviewer().getEmail(),
            "Clarification received — " + e.productName(),
            renderClarificationResponded(e)
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ItemRecalledEvent e) {
        if (!settings.isEmailEnabled()) return;
        if (e.reviewer() == null) return;
        email.sendHtml(
            e.reviewer().getEmail(),
            "Estimate item recalled — " + e.productName(),
            renderItemRecalled(e)
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ItemSentBackEvent e) {
        if (!settings.isEmailEnabled()) return;
        email.sendHtml(
            e.requester().getEmail(),
            "Estimate approval withdrawn — " + e.productName(),
            renderItemSentBack(e)
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(InvitationEmailRequestedEvent e) {
        if (!settings.isEmailEnabled()) return;
        email.sendHtml(
            e.invitee().getEmail(),
            "You've been invited to the IT Estimation Portal",
            renderInvitation(e)
        );
    }

    // ---- HTML templates ------------------------------------------------

    private String renderItemSubmitted(User so, ItemSubmittedEvent e) {
        String link = portalLink("/review");
        return frame(
            "Hi " + firstName(so) + ",",
            "A new estimate item is ready for your review.",
            "<strong>Request:</strong> " + esc(e.requestTitle()) + "<br>" +
            "<strong>Product:</strong> " + esc(e.productName()),
            "Open Review Queue", link
        );
    }

    private String renderItemApproved(ItemApprovedEvent e) {
        String link = portalLink("/requests/" + e.requestId());
        return frame(
            "Hi " + firstName(e.requester()) + ",",
            "Great news — your estimate item has been approved.",
            "<strong>Request:</strong> " + esc(e.requestTitle()) + "<br>" +
            "<strong>Product:</strong> " + esc(e.productName()),
            "View Estimate", link
        );
    }

    private String renderItemRejected(ItemRejectedEvent e) {
        String reasonBlock = (e.reason() != null && !e.reason().isBlank())
            ? "<strong>Reason:</strong> " + esc(e.reason()) + "<br>"
            : "";
        String link = portalLink("/requests/" + e.requestId());
        return frame(
            "Hi " + firstName(e.requester()) + ",",
            "Your estimate item has been returned for revision.",
            "<strong>Request:</strong> " + esc(e.requestTitle()) + "<br>" +
            "<strong>Product:</strong> " + esc(e.productName()) + "<br>" +
            reasonBlock,
            "View & Revise", link
        );
    }

    private String renderItemNeedsClarification(ItemNeedsClarificationEvent e) {
        String noteBlock = (e.note() != null && !e.note().isBlank())
            ? "<strong>Note from reviewer:</strong><br>" +
              "<blockquote style=\"margin:8px 0 0 0;padding:8px 12px;border-left:3px solid #ccc;color:#555\">"
              + esc(e.note()) + "</blockquote><br>"
            : "";
        String link = portalLink("/requests/" + e.requestId());
        return frame(
            "Hi " + firstName(e.requester()) + ",",
            "A reviewer has requested clarification on your estimate item.",
            "<strong>Request:</strong> " + esc(e.requestTitle()) + "<br>" +
            "<strong>Product:</strong> " + esc(e.productName()) + "<br>" +
            noteBlock,
            "Respond to Clarification", link
        );
    }

    private String renderClarificationResponded(ClarificationRespondedEvent e) {
        String link = portalLink("/review/" + e.requestId());
        return frame(
            "Hi " + firstName(e.reviewer()) + ",",
            "The requester has responded to your clarification request.",
            "<strong>Request:</strong> " + esc(e.requestTitle()) + "<br>" +
            "<strong>Product:</strong> " + esc(e.productName()),
            "Continue Review", link
        );
    }

    private String renderItemRecalled(ItemRecalledEvent e) {
        String link = portalLink("/review");
        return frame(
            "Hi " + firstName(e.reviewer()) + ",",
            "An estimate item you were reviewing has been recalled by the requester.",
            "<strong>Request:</strong> " + esc(e.requestTitle()) + "<br>" +
            "<strong>Product:</strong> " + esc(e.productName()),
            "Back to Review Queue", link
        );
    }

    private String renderItemSentBack(ItemSentBackEvent e) {
        String link = portalLink("/requests/" + e.requestId());
        return frame(
            "Hi " + firstName(e.requester()) + ",",
            "An approved estimate item has been sent back for re-review by an administrator.",
            "<strong>Request:</strong> " + esc(e.requestTitle()) + "<br>" +
            "<strong>Product:</strong> " + esc(e.productName()),
            "View Estimate", link
        );
    }

    private String renderInvitation(InvitationEmailRequestedEvent e) {
        String expiry = e.expiresAt() != null
            ? e.expiresAt().format(DATE_FMT)
            : "14 days";
        return frame(
            "Hi " + firstName(e.invitee()) + ",",
            "You've been invited to join the IT Estimation Portal. Click the button below to set up your account.",
            "This invitation link expires on <strong>" + esc(expiry) + "</strong>.",
            "Accept Invitation", e.inviteUrl()
        );
    }

    // ---- shared frame --------------------------------------------------

    private String frame(String greeting, String lead, String details, String btnLabel, String btnUrl) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f5f5f4;font-family:sans-serif">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 0">
                <tr><td align="center">
                  <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
                    <tr>
                      <td style="background:#1a1a1a;padding:20px 28px">
                        <span style="color:#ffffff;font-size:16px;font-weight:600;letter-spacing:.5px">IT Estimation Portal</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px 28px 8px">
                        <p style="margin:0 0 12px;color:#1a1a1a;font-size:15px;font-weight:600">%s</p>
                        <p style="margin:0 0 16px;color:#444;font-size:14px;line-height:1.6">%s</p>
                        <p style="margin:0 0 24px;color:#555;font-size:13px;line-height:1.6">%s</p>
                        <a href="%s"
                           style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;
                                  padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500">
                          %s
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 28px;border-top:1px solid #e5e5e5">
                        <p style="margin:0;color:#999;font-size:12px;line-height:1.5">
                          This is an automated message from the IT Estimation Portal.
                          Please do not reply to this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(greeting, lead, details, btnUrl, btnLabel);
    }

    // ---- helpers -------------------------------------------------------

    private String portalLink(String path) {
        String base = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
        return base + path;
    }

    private String firstName(User u) {
        return u != null && u.getFirstName() != null ? esc(u.getFirstName()) : "there";
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

}
