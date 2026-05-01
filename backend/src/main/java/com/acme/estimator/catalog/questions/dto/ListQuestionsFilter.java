package com.acme.estimator.catalog.questions.dto;

/**
 * Cross-catalog browser filter. {@code parentType} is null for "All",
 * "Product" for product-attached only, "SubFeature" for sub-feature-
 * attached only. {@code requiredOnly} / {@code activeOnly} use the same
 * three-state pattern as ListProductsFilter.
 */
public record ListQuestionsFilter(
    String search,
    String parentType,
    Boolean requiredOnly,
    Boolean activeOnly
) {}
