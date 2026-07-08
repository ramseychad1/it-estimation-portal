package com.acme.estimator.users.dto;

import java.time.OffsetDateTime;

/**
 * Admin-facing response to POST {@code /api/admin/users/{id}/reset-password}
 * (SEC-1). Carries the copy/paste reset link so the admin can hand it to the
 * user out-of-band — email delivery isn't wired up. Travels over TLS to an
 * authenticated admin; the raw generated password is never produced or logged.
 */
public record PasswordResetLinkResponse(
    String resetUrl,
    OffsetDateTime expiresAt
) {}
