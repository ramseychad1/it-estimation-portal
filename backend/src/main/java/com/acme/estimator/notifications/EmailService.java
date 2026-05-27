package com.acme.estimator.notifications;

import com.acme.estimator.common.ApiException;
import com.acme.estimator.settings.AppSettingService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.util.Properties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import static com.acme.estimator.settings.AppSettingService.*;

/**
 * Sends HTML emails via a dynamically configured JavaMailSenderImpl.
 * SMTP settings are read from app_settings on each call so that admin
 * changes take effect immediately without a restart.
 *
 * email_from_address supports Gmail "Send mail as" verified aliases.
 * Leave it blank to use email_smtp_username as the From address.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final AppSettingService settings;

    public void sendHtml(String to, String subject, String htmlBody) {
        JavaMailSenderImpl sender = buildSender();
        if (sender == null) return;

        try {
            sender.send(buildMessage(sender, to, subject, htmlBody));
            log.info("Email sent to {} — subject: {}", to, subject);
        } catch (Exception e) {
            // Never let email failure roll back a business transaction or crash a caller.
            log.warn("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    /**
     * Like sendHtml but throws on failure so the admin UI can surface the reason.
     * Only called from the test-email endpoint — not from notification handlers.
     */
    public void sendTestEmail(String toAddress) {
        JavaMailSenderImpl sender = buildSender();
        if (sender == null) {
            throw ApiException.badRequest("SMTP username or password is not configured.");
        }
        String html = """
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#1a1a1a;margin:0 0 16px">IT Estimation Portal</h2>
              <p style="color:#555;line-height:1.6;margin:0 0 24px">
                This is a test email confirming that your SMTP configuration is working correctly.
              </p>
              <p style="color:#888;font-size:13px;margin:0">
                This message was sent from the IT Estimation Portal notification system.
              </p>
            </div>
            """;
        try {
            sender.send(buildMessage(sender, toAddress, "IT Estimation Portal — Test Email", html));
        } catch (Exception e) {
            throw ApiException.badRequest("Could not connect to SMTP server: " + rootMessage(e));
        }
    }

    private MimeMessage buildMessage(JavaMailSenderImpl sender, String to, String subject, String htmlBody)
            throws MessagingException, UnsupportedEncodingException {
        String fromName    = settings.getString(KEY_EMAIL_FROM_NAME, "IT Estimation Portal");
        String fromAddress = settings.getString(KEY_EMAIL_FROM_ADDRESS, "");
        if (fromAddress.isBlank()) {
            fromAddress = settings.getString(KEY_EMAIL_SMTP_USERNAME, "");
        }
        MimeMessage message = sender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);
        helper.setFrom(new InternetAddress(fromAddress, fromName));
        return message;
    }

    private JavaMailSenderImpl buildSender() {
        String host     = settings.getString(KEY_EMAIL_SMTP_HOST, "smtp.gmail.com");
        int    port     = settings.getInt(KEY_EMAIL_SMTP_PORT, 587);
        String username = settings.getString(KEY_EMAIL_SMTP_USERNAME, "");
        String password = settings.getString(KEY_EMAIL_SMTP_PASSWORD, "");

        if (username.isBlank() || password.isBlank()) {
            log.warn("Email SMTP username or password is not configured — skipping send");
            return null;
        }

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(password);

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        if (port == 465) {
            // SSL/TLS — encrypted from the first packet (required on Railway; port 587/STARTTLS is blocked)
            props.put("mail.smtp.ssl.enable", "true");
            props.put("mail.smtp.ssl.trust", host);
        } else {
            // STARTTLS — upgrades a plain connection to TLS (port 587)
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.starttls.required", "true");
        }
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");

        return sender;
    }

    private static String rootMessage(Throwable t) {
        Throwable cause = t;
        while (cause.getCause() != null) cause = cause.getCause();
        return cause.getMessage() != null ? cause.getMessage() : t.getMessage();
    }
}
