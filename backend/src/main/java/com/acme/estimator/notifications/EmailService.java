package com.acme.estimator.notifications;

import com.acme.estimator.common.ApiException;
import com.acme.estimator.settings.AppSettingService;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.io.UnsupportedEncodingException;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import static com.acme.estimator.settings.AppSettingService.*;

/**
 * Sends HTML emails via either Resend (HTTP API) or JavaMail (SMTP).
 * Provider is selected by the email_provider setting ("resend" or "smtp").
 * Settings are read from app_settings on each call so admin changes take
 * effect immediately without a restart.
 *
 * Railway blocks outbound SMTP (ports 587 and 465 both time out due to
 * Google Cloud IP restrictions). Use Resend for production deployments on Railway.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private static final String PROVIDER_RESEND = "resend";
    private static final String PROVIDER_GMAIL  = "gmail";

    private final AppSettingService settings;

    /**
     * Fire-and-forget send. Logs on failure, never throws.
     * Used by NotificationService so email errors can never roll back a business transaction.
     */
    public void sendHtml(String to, String subject, String htmlBody) {
        try {
            dispatch(to, subject, htmlBody);
            log.info("Email sent to {} — subject: {}", to, subject);
        } catch (Exception e) {
            log.warn("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    /**
     * Same send but throws ApiException on failure so the admin UI gets a real error message.
     * Only called from the test-email endpoint.
     */
    public void sendTestEmail(String toAddress) {
        String html = """
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#1a1a1a;margin:0 0 16px">IT Estimation Portal</h2>
              <p style="color:#555;line-height:1.6;margin:0 0 24px">
                This is a test email confirming that your email configuration is working correctly.
              </p>
              <p style="color:#888;font-size:13px;margin:0">
                This message was sent from the IT Estimation Portal notification system.
              </p>
            </div>
            """;
        try {
            dispatch(toAddress, "IT Estimation Portal — Test Email", html);
        } catch (Exception e) {
            throw ApiException.badRequest("Could not send email: " + rootMessage(e));
        }
    }

    // ---- internal -------------------------------------------------------

    private void dispatch(String to, String subject, String htmlBody) throws Exception {
        String provider = settings.getString(KEY_EMAIL_PROVIDER, "smtp");
        if (PROVIDER_RESEND.equalsIgnoreCase(provider)) {
            sendViaResend(to, subject, htmlBody);
        } else if (PROVIDER_GMAIL.equalsIgnoreCase(provider)) {
            sendViaGmail(to, subject, htmlBody);
        } else {
            sendViaSmtp(to, subject, htmlBody);
        }
    }

    // ---- Resend ----------------------------------------------------------

    private void sendViaResend(String to, String subject, String htmlBody) {
        String apiKey = settings.getString(KEY_EMAIL_RESEND_API_KEY, "");
        if (apiKey.isBlank()) {
            throw new IllegalStateException("Resend API key is not configured.");
        }

        String fromName    = settings.getString(KEY_EMAIL_FROM_NAME, "IT Estimation Portal");
        String fromAddress = settings.getString(KEY_EMAIL_FROM_ADDRESS, "");
        if (fromAddress.isBlank()) {
            fromAddress = settings.getString(KEY_EMAIL_SMTP_USERNAME, "");
        }
        String from = fromAddress.isBlank()
            ? fromName
            : fromName + " <" + fromAddress + ">";

        Map<String, Object> body = Map.of(
            "from", from,
            "to", List.of(to),
            "subject", subject,
            "html", htmlBody
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<Map<String, Object>> response = new RestTemplate().exchange(
                "https://api.resend.com/emails",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                new org.springframework.core.ParameterizedTypeReference<>() {}
            );
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new IllegalStateException("Resend returned " + response.getStatusCode());
            }
        } catch (HttpClientErrorException e) {
            throw new IllegalStateException("Resend API error: " + e.getResponseBodyAsString(), e);
        }
    }

    // ---- Gmail OAuth2 ---------------------------------------------------

    private void sendViaGmail(String to, String subject, String htmlBody) throws Exception {
        String clientId     = settings.getString(KEY_EMAIL_GMAIL_CLIENT_ID, "");
        String clientSecret = settings.getString(KEY_EMAIL_GMAIL_CLIENT_SECRET, "");
        String refreshToken = settings.getString(KEY_EMAIL_GMAIL_REFRESH_TOKEN, "");

        if (clientId.isBlank() || clientSecret.isBlank() || refreshToken.isBlank()) {
            throw new IllegalStateException("Gmail OAuth2 is not fully configured. Connect your Gmail account in Global Settings.");
        }

        String accessToken = refreshGmailAccessToken(clientId, clientSecret, refreshToken);
        String rawMessage  = buildGmailMimeMessage(to, subject, htmlBody);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            new RestTemplate().exchange(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("raw", rawMessage), headers),
                new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {}
            );
        } catch (HttpClientErrorException e) {
            throw new IllegalStateException("Gmail API error: " + e.getResponseBodyAsString(), e);
        }
    }

    private String refreshGmailAccessToken(String clientId, String clientSecret, String refreshToken) {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("client_id",     clientId);
        params.add("client_secret", clientSecret);
        params.add("refresh_token", refreshToken);
        params.add("grant_type",    "refresh_token");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        try {
            ResponseEntity<Map<String, Object>> resp = new RestTemplate().exchange(
                "https://oauth2.googleapis.com/token",
                HttpMethod.POST,
                new HttpEntity<>(params, headers),
                new org.springframework.core.ParameterizedTypeReference<>() {}
            );
            Map<String, Object> body = resp.getBody();
            if (body == null || !body.containsKey("access_token")) {
                throw new IllegalStateException("No access_token in Gmail token refresh response.");
            }
            return (String) body.get("access_token");
        } catch (HttpClientErrorException e) {
            throw new IllegalStateException("Gmail token refresh failed: " + e.getResponseBodyAsString(), e);
        }
    }

    private String buildGmailMimeMessage(String to, String subject, String htmlBody)
            throws Exception {
        String fromName    = settings.getString(KEY_EMAIL_FROM_NAME, "IT Estimation Portal");
        String fromAddress = settings.getString(KEY_EMAIL_GMAIL_CONNECTED_EMAIL, "");

        Session session = Session.getDefaultInstance(new Properties());
        MimeMessage message = new MimeMessage(session);
        message.setFrom(new InternetAddress(fromAddress, fromName, "UTF-8"));
        message.addRecipient(Message.RecipientType.TO, new InternetAddress(to));
        message.setSubject(subject, "UTF-8");
        message.setContent(htmlBody, "text/html; charset=UTF-8");

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        message.writeTo(buffer);
        return Base64.getUrlEncoder().encodeToString(buffer.toByteArray());
    }

    // ---- SMTP ------------------------------------------------------------

    private void sendViaSmtp(String to, String subject, String htmlBody)
            throws MessagingException, UnsupportedEncodingException {
        JavaMailSenderImpl sender = buildSmtpSender();
        if (sender == null) {
            throw new IllegalStateException("SMTP username or password is not configured.");
        }
        sender.send(buildMessage(sender, to, subject, htmlBody));
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

    private JavaMailSenderImpl buildSmtpSender() {
        String host     = settings.getString(KEY_EMAIL_SMTP_HOST, "smtp.gmail.com");
        int    port     = settings.getInt(KEY_EMAIL_SMTP_PORT, 587);
        String username = settings.getString(KEY_EMAIL_SMTP_USERNAME, "");
        String password = settings.getString(KEY_EMAIL_SMTP_PASSWORD, "");

        if (username.isBlank() || password.isBlank()) {
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
            props.put("mail.smtp.ssl.enable", "true");
            props.put("mail.smtp.ssl.trust", host);
        } else {
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.starttls.required", "true");
        }
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");

        return sender;
    }

    // ---- util ------------------------------------------------------------

    private static String rootMessage(Throwable t) {
        Throwable cause = t;
        while (cause.getCause() != null) cause = cause.getCause();
        return cause.getMessage() != null ? cause.getMessage() : t.getMessage();
    }
}
