package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Admin send-back payload. The reason is captured in the SENT_BACK
 * change_log row's notes. Required because admin send-back is a
 * non-routine intervention — the audit trail needs context.
 */
public record SendBackRequest(
    @NotBlank @Size(max = 4000) String reason
) {}
