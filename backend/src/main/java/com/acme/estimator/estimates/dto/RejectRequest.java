package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Reject payload. The justification overwrites whatever was autosaved
 * during In Review — the modal lets the SO finalize the rejection
 * reason before committing to the terminal state.
 */
public record RejectRequest(
    @NotBlank @Size(max = 4000) String justification
) {}
