package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;

public record ItemRecalledEvent(
    Long requestId,
    String requestTitle,
    Long itemId,
    String productName,
    User reviewer
) implements NotificationEvent {}
