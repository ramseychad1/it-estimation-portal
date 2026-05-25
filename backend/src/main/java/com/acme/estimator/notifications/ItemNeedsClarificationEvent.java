package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;

public record ItemNeedsClarificationEvent(
    Long requestId,
    String requestTitle,
    Long itemId,
    String productName,
    User requester,
    String note
) implements NotificationEvent {}
