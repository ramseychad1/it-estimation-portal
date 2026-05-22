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
