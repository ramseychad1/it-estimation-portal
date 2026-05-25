package com.acme.estimator.settings;

import com.acme.estimator.auth.AppUserDetails;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AppSettingService {

    static final String KEY_REVENUE_REVIEW_ENABLED = "revenue_review_enabled";

    public static final String KEY_EMAIL_ENABLED       = "email_enabled";
    public static final String KEY_EMAIL_SMTP_HOST     = "email_smtp_host";
    public static final String KEY_EMAIL_SMTP_PORT     = "email_smtp_port";
    public static final String KEY_EMAIL_SMTP_USERNAME = "email_smtp_username";
    public static final String KEY_EMAIL_SMTP_PASSWORD = "email_smtp_password";
    public static final String KEY_EMAIL_FROM_NAME     = "email_from_name";
    public static final String KEY_EMAIL_FROM_ADDRESS  = "email_from_address";

    private final AppSettingRepository repo;

    @Transactional(readOnly = true)
    public Map<String, String> getAll() {
        return repo.findAll().stream()
            .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue));
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
        return getAll();
    }

    private Long currentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof AppUserDetails d) {
            return d.getUserId();
        }
        return null;
    }
}
