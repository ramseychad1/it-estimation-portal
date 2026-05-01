package com.acme.estimator.users.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Body for the public POST {@code /api/auth/invitations/{token}/accept}.
 * Password complexity per the prompt: minimum 8 chars, at least one letter
 * and one digit. Length capped at 128 to avoid pathological inputs.
 */
public record AcceptInviteRequest(
    @NotBlank
    @Size(min = 8, max = 128)
    @Pattern(
        regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
        message = "Password must contain at least one letter and one digit."
    )
    String password
) {}
