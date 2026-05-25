package com.acme.estimator.notifications;

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

        String fromName    = settings.getString(KEY_EMAIL_FROM_NAME, "IT Estimation Portal");
        String fromAddress = settings.getString(KEY_EMAIL_FROM_ADDRESS, "");
        if (fromAddress.isBlank()) {
            fromAddress = settings.getString(KEY_EMAIL_SMTP_USERNAME, "");
        }

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            helper.setFrom(new InternetAddress(fromAddress, fromName));
            sender.send(message);
            log.info("Email sent to {} — subject: {}", to, subject);
        } catch (MessagingException | UnsupportedEncodingException e) {
            log.warn("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    public void sendTestEmail(String toAddress) {
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
        sendHtml(toAddress, "IT Estimation Portal — Test Email", html);
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
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "5000");
        props.put("mail.smtp.writetimeout", "5000");

        return sender;
    }
}
