package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Payload for the SO's "Request Clarification" action on an IN_REVIEW item.
 *
 * <p>The note is required — an empty clarification request gives the requester
 * nothing to act on. Capped at 2000 characters to mirror other free-text fields.
 */
public record RequestClarificationRequest(
    @NotBlank(message = "A clarification note is required.")
    @Size(max = 2000, message = "Clarification note must be 2000 characters or fewer.")
    String clarificationNote
) {}
