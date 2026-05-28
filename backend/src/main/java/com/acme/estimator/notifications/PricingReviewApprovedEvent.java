package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;

public record PricingReviewApprovedEvent(
    Long requestId,
    String requestTitle,
    User requester
) implements NotificationEvent {}
