package com.acme.estimator.settings;

import com.acme.estimator.auth.User;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
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
    public Map<String, String> set(String key, String value, User actor) {
        AppSetting setting = repo.findById(key)
            .orElseGet(() -> {
                AppSetting s = new AppSetting();
                s.setKey(key);
                return s;
            });
        setting.setValue(value);
        setting.setUpdatedAt(OffsetDateTime.now());
        setting.setUpdatedBy(actor.getId());
        repo.save(setting);
        return getAll();
    }

    @Transactional
    public Map<String, String> setAll(Map<String, String> updates, User actor) {
        for (Map.Entry<String, String> entry : updates.entrySet()) {
            set(entry.getKey(), entry.getValue(), actor);
        }
        return getAll();
    }
}
