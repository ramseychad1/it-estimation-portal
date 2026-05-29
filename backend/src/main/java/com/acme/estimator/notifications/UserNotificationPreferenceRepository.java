package com.acme.estimator.notifications;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserNotificationPreferenceRepository extends JpaRepository<UserNotificationPreference, Long> {

    List<UserNotificationPreference> findByUserId(Long userId);

    Optional<UserNotificationPreference> findByUserIdAndNotificationType(Long userId, NotificationType type);

    void deleteByUserId(Long userId);
}
