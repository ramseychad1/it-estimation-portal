package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Request body for an SO adding a catalog scope item to an INTAKE request.
 *
 * <p>The SO selects a catalog product (and optional sub-feature for CONTAINER products).
 * The item is created in IN_REVIEW state with the calling SO as reviewer.
 *
 * <p>V30: new endpoint — POST /api/estimates/review/{requestId}/scope-item.
 */
public record AddScopeItemRequest(
    @NotNull Long productId,
    /** Required when the chosen product is CONTAINER; null for ATOMIC products. */
    Long subFeatureId
) {}
