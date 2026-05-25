package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;

public record ItemSentBackEvent(
    Long requestId,
    String requestTitle,
    Long itemId,
    String productName,
    User requester
) implements NotificationEvent {}
