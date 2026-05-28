package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;
import java.util.List;

public record RequestSentToPricingReviewEvent(
    Long requestId,
    String requestTitle,
    User requester,
    List<User> revenueManagers
) implements NotificationEvent {}
