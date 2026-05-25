package com.acme.estimator.notifications;

import com.acme.estimator.auth.User;
import java.time.OffsetDateTime;

public record InvitationEmailRequestedEvent(
    User invitee,
    String inviteUrl,
    OffsetDateTime expiresAt
) implements NotificationEvent {}
