package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;

public record ItemApprovedEvent(
    Long requestId,
    String requestTitle,
    Long itemId,
    String productName,
    User requester
) implements NotificationEvent {}
