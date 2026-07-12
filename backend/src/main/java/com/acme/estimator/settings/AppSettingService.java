package com.acme.estimator.settings;

import com.acme.estimator.auth.AppUserDetails;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AppSettingService {

    static final String KEY_REVENUE_REVIEW_ENABLED = "revenue_review_enabled";

    public static final String KEY_EMAIL_ENABLED        = "email_enabled";
    public static final String KEY_EMAIL_PROVIDER       = "email_provider";   // "smtp" | "resend"
    public static final String KEY_EMAIL_SMTP_HOST      = "email_smtp_host";
    public static final String KEY_EMAIL_SMTP_PORT      = "email_smtp_port";
    public static final String KEY_EMAIL_SMTP_USERNAME  = "email_smtp_username";
    public static final String KEY_EMAIL_SMTP_PASSWORD  = "email_smtp_password";
    public static final String KEY_EMAIL_FROM_NAME      = "email_from_name";
    public static final String KEY_EMAIL_FROM_ADDRESS   = "email_from_address";
    public static final String KEY_EMAIL_RESEND_API_KEY = "email_resend_api_key";

    /** Global default contingency % (fraction, e.g. "0.10") used by the estimator. */
    public static final String KEY_DEFAULT_CONTINGENCY_PCT = "default_contingency_pct";

    public static final String KEY_EMAIL_GMAIL_CLIENT_ID      = "email_gmail_client_id";
    public static final String KEY_EMAIL_GMAIL_CLIENT_SECRET  = "email_gmail_client_secret";
    public static final String KEY_EMAIL_GMAIL_REFRESH_TOKEN  = "email_gmail_refresh_token";
    public static final String KEY_EMAIL_GMAIL_CONNECTED_EMAIL = "email_gmail_connected_email";

    /**
     * Credential-equivalent keys (SEC-2). Their values are never returned to
     * the client — {@link #getAllForDisplay()} replaces a stored secret with
     * {@link #REDACTED} so cleartext credentials don't land in response
     * bodies, the browser network log, or the React Query cache.
     */
    static final Set<String> SECRET_KEYS = Set.of(
        KEY_EMAIL_SMTP_PASSWORD,
        KEY_EMAIL_RESEND_API_KEY,
        KEY_EMAIL_GMAIL_CLIENT_SECRET,
        KEY_EMAIL_GMAIL_REFRESH_TOKEN
    );

    /** Sentinel returned in place of a configured secret. Also means "keep existing" on write. */
    static final String REDACTED = "********";

    private final AppSettingRepository repo;

    /** RAW values — internal callers only (never exposed over the API). */
    @Transactional(readOnly = true)
    public Map<String, String> getAll() {
        return repo.findAll().stream()
            .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue));
    }

    /**
     * API-facing view: every setting, but secret values masked. A configured
     * secret shows {@link #REDACTED}; an unset/blank one shows "". The client
     * only needs to know a secret <em>is</em> set, never what it is.
     */
    @Transactional(readOnly = true)
    public Map<String, String> getAllForDisplay() {
        Map<String, String> out = new LinkedHashMap<>();
        for (AppSetting s : repo.findAll()) {
            if (SECRET_KEYS.contains(s.getKey())) {
                boolean set = s.getValue() != null && !s.getValue().isBlank();
                out.put(s.getKey(), set ? REDACTED : "");
            } else {
                out.put(s.getKey(), s.getValue());
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public boolean isRevenueReviewEnabled() {
        return repo.findById(KEY_REVENUE_REVIEW_ENABLED)
            .map(s -> "true".equalsIgnoreCase(s.getValue()))
            .orElse(false);
    }

    @Transactional(readOnly = true)
    public boolean isEmailEnabled() {
        return repo.findById(KEY_EMAIL_ENABLED)
            .map(s -> "true".equalsIgnoreCase(s.getValue()))
            .orElse(false);
    }

    @Transactional(readOnly = true)
    public String getString(String key, String defaultValue) {
        return repo.findById(key)
            .map(AppSetting::getValue)
            .filter(v -> v != null && !v.isBlank())
            .orElse(defaultValue);
    }

    @Transactional(readOnly = true)
    public java.math.BigDecimal getBigDecimal(String key, java.math.BigDecimal defaultValue) {
        return repo.findById(key)
            .map(AppSetting::getValue)
            .filter(v -> v != null && !v.isBlank())
            .map(v -> {
                try { return new java.math.BigDecimal(v.trim()); }
                catch (NumberFormatException e) { return defaultValue; }
            })
            .orElse(defaultValue);
    }

    @Transactional(readOnly = true)
    public int getInt(String key, int defaultValue) {
        return repo.findById(key)
            .map(s -> {
                try { return Integer.parseInt(s.getValue()); }
                catch (NumberFormatException e) { return defaultValue; }
            })
            .orElse(defaultValue);
    }

    @Transactional
    public Map<String, String> setAll(Map<String, String> updates) {
        Long actorId = currentUserId();
        for (Map.Entry<String, String> entry : updates.entrySet()) {
            // Defence in depth (SEC-2): a client echoing back the REDACTED
            // sentinel for a secret means "leave it unchanged" — never
            // overwrite a real secret with the mask. (The UI already omits
            // untouched secrets; this guards any other caller.)
            if (SECRET_KEYS.contains(entry.getKey()) && REDACTED.equals(entry.getValue())) {
                continue;
            }
            AppSetting setting = repo.findById(entry.getKey())
                .orElseGet(() -> {
                    AppSetting s = new AppSetting();
                    s.setKey(entry.getKey());
                    return s;
                });
            setting.setValue(entry.getValue());
            setting.setUpdatedAt(OffsetDateTime.now());
            setting.setUpdatedBy(actorId);
            repo.save(setting);
        }
        return getAllForDisplay();
    }

    private Long currentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof AppUserDetails d) {
            return d.getUserId();
        }
        return null;
    }
}
