package com.acme.estimator.users.dto;

/**
 * Response from successful invitation acceptance. Intentionally minimal —
 * the user logs in via the standard form afterwards; we don't auto-create
 * a session here.
 */
public record AcceptInviteResult(
    String email
) {}
