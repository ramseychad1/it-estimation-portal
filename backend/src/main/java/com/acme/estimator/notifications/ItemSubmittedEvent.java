package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;
import java.util.List;

public record ItemSubmittedEvent(
    Long requestId,
    String requestTitle,
    Long itemId,
    String productName,
    List<User> soRecipients
) implements NotificationEvent {}
