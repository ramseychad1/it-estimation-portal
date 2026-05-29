package com.acme.estimator.notifications;

import java.util.List;

public record NotificationPrefsResponse(
    boolean masterEnabled,
    List<NotificationPrefItem> preferences
) {}
