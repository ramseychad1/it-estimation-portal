package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;

public record ItemRejectedEvent(
    Long requestId,
    String requestTitle,
    Long itemId,
    String productName,
    User requester,
    String reason
) implements NotificationEvent {}
