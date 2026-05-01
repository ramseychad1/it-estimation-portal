package com.acme.estimator.catalog.subfeatures.dto;

import jakarta.validation.constraints.Size;

/**
 * PATCH payload for a sub-feature. Active-flag flips go through dedicated
 * /activate /deactivate endpoints and are rejected here.
 */
public record UpdateSubFeatureRequest(
    @Size(max = 255) String name,
    @Size(max = 4000) String description,
    Boolean active
) {}
