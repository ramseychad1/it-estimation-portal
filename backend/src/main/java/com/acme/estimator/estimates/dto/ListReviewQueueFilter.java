package com.acme.estimator.estimates.dto;

import com.acme.estimator.estimates.EstimateStatus;

/**
 * Reviewer-side queue filter. Defaults to "all open" (Submitted +
 * In Review) when {@code status} is null. {@code mineOnly} is the
 * "show me what I claimed" toggle — combined with status it produces
 * the standard filter intersection (e.g., mineOnly + Submitted always
 * returns empty because claimed requests are In Review by definition;
 * the UI surfaces that as the standard filtered-empty state).
 */
public record ListReviewQueueFilter(
    EstimateStatus status,
    String search,
    Long productId,
    boolean mineOnly
) {}
