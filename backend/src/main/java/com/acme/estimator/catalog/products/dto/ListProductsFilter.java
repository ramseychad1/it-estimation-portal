package com.acme.estimator.catalog.products.dto;

import com.acme.estimator.catalog.products.ProductMode;

/**
 * Server-side projection of the controller's query string into a stable
 * shape. {@code status} is null for "all", true for active-only, false
 * for inactive-only — same convention as {@code TeamService.StatusFilter}
 * but flattened to a {@code Boolean} since there's only one knob.
 */
public record ListProductsFilter(
    String search,
    ProductMode mode,
    Boolean activeOnly,
    /** Optional team filter — null means all teams (including unassigned). */
    Long teamId
) {}
