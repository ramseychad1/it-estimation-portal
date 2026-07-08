package com.acme.estimator.users.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Body for the public POST {@code /api/auth/password-resets/{token}}. No
 * current-password check — the whole point of an admin-issued reset is that
 * the user may have forgotten it. Same complexity rule as invite-accept and
 * change-password (min 8 / max 128 / letter + digit).
 */
public record CompletePasswordResetRequest(
    @NotBlank
    @Size(min = 8, max = 128)
    @Pattern(
        regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
        message = "Password must contain at least one letter and one digit."
    )
    String password
) {}
