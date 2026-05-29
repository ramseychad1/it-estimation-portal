package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {

    private final UserRepository userRepo;
    private final UserNotificationPreferenceRepository prefRepo;

    @Transactional(readOnly = true)
    public NotificationPrefsResponse getPrefs(Long userId) {
        User user = userRepo.findById(userId)
            .orElseThrow(() -> new IllegalStateException("User not found: " + userId));

        Map<NotificationType, UserNotificationPreference> existing =
            prefRepo.findByUserId(userId).stream()
                .collect(Collectors.toMap(
                    UserNotificationPreference::getNotificationType,
                    Function.identity()
                ));

        List<NotificationPrefItem> items = Arrays.stream(NotificationType.values())
            .map(type -> {
                boolean enabled = existing.containsKey(type)
                    ? existing.get(type).isEnabled()
                    : true;
                return new NotificationPrefItem(
                    type.name(), type.label, type.description, type.roleNote, enabled
                );
            })
            .toList();

        return new NotificationPrefsResponse(user.isNotificationsEnabled(), items);
    }

    @Transactional
    public NotificationPrefsResponse savePrefs(Long userId, UpdateNotificationPrefsRequest req) {
        User user = userRepo.findById(userId)
            .orElseThrow(() -> new IllegalStateException("User not found: " + userId));

        user.setNotificationsEnabled(req.masterEnabled());
        userRepo.save(user);

        if (req.preferences() != null) {
            for (Map.Entry<String, Boolean> entry : req.preferences().entrySet()) {
                NotificationType type;
                try {
                    type = NotificationType.valueOf(entry.getKey());
                } catch (IllegalArgumentException e) {
                    continue; // ignore unknown types
                }

                UserNotificationPreference pref =
                    prefRepo.findByUserIdAndNotificationType(userId, type)
                        .orElseGet(() -> new UserNotificationPreference(userId, type, true));

                pref.setEnabled(entry.getValue());
                pref.setUpdatedAt(OffsetDateTime.now());
                prefRepo.save(pref);
            }
        }

        return getPrefs(userId);
    }

    /**
     * Called by NotificationService before sending to a recipient.
     * Returns false if the user has opted out globally or disabled this specific type.
     * Defaults to true (enabled) when no preference row exists.
     */
    @Transactional(readOnly = true)
    public boolean isEnabled(Long userId, NotificationType type) {
        User user = userRepo.findById(userId).orElse(null);
        if (user == null || !user.isNotificationsEnabled()) return false;
        return prefRepo.findByUserIdAndNotificationType(userId, type)
            .map(UserNotificationPreference::isEnabled)
            .orElse(true);
    }
}
