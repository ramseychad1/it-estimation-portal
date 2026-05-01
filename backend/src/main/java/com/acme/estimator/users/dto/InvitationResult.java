package com.acme.estimator.users.dto;

import java.time.OffsetDateTime;

/**
 * Returned by the invite + resend endpoints. {@code inviteUrl} is exposed
 * in the response body for now because there's no email infrastructure
 * yet — the admin copies it manually. When real email is wired up, this
 * field stops appearing in API responses and lives only in the email body.
 */
public record InvitationResult(
    UserDetail user,
    String inviteUrl,
    OffsetDateTime tokenExpiresAt
) {}
