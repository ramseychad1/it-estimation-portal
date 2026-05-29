package com.acme.estimator.notifications;

import java.util.List;

public record NotificationPrefsResponse(
    boolean globalEmailEnabled,
    boolean masterEnabled,
    List<NotificationPrefItem> preferences
) {}
