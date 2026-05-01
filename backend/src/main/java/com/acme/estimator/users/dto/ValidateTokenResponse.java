package com.acme.estimator.users.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.OffsetDateTime;

/**
 * Public response for GET {@code /api/auth/invitations/{token}}. Used by
 * the accept-invite page to decide whether to show the password form or
 * a "this invite is no longer valid" message.
 *
 * When valid is false, email and expiresAt are omitted (don't leak account
 * existence). When valid is true, they're populated.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ValidateTokenResponse(
    boolean valid,
    String email,
    OffsetDateTime expiresAt
) {
    public static ValidateTokenResponse invalid() {
        return new ValidateTokenResponse(false, null, null);
    }

    public static ValidateTokenResponse valid(String email, OffsetDateTime expiresAt) {
        return new ValidateTokenResponse(true, email, expiresAt);
    }
}
