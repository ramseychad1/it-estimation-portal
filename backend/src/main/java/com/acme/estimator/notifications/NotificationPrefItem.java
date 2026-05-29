package com.acme.estimator.notifications;

public record NotificationPrefItem(
    String type,
    String label,
    String description,
    String roleNote,
    boolean enabled
) {}
