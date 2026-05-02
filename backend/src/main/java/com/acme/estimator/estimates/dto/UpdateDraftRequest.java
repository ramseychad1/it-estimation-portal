package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.Size;

/**
 * Patch-style: a field is only applied if the JSON key is present
 * (non-null). Title cannot be blanked but may be omitted.
 */
public record UpdateDraftRequest(
    @Size(min = 1, max = 255) String title,
    @Size(max = 4000) String description
) {}
