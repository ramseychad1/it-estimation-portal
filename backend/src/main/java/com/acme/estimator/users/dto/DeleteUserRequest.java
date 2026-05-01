package com.acme.estimator.users.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Body for {@code DELETE /api/admin/users/{id}}. Forces the admin to type
 * the user's full name to confirm — server-side equivalent of the typed-name
 * confirmation modal.
 */
public record DeleteUserRequest(
    @NotBlank String confirmationName
) {}
