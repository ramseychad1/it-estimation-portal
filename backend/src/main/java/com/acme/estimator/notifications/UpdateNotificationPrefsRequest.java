package com.acme.estimator.notifications;

import java.util.Map;

public record UpdateNotificationPrefsRequest(
    boolean masterEnabled,
    Map<String, Boolean> preferences
) {}
