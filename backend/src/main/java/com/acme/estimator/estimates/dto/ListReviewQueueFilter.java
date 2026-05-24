package com.acme.estimator.estimates.dto;

/**
 * Reviewer-side queue filter. Defaults to "all open" (Submitted +
 * In Review) when {@code status} is null. {@code mineOnly} is the
 * "show me what I claimed" toggle.
 *
 * <p>Phase 9a: {@code status} is now a String to allow derived statuses
 * (SUBMITTED, IN_REVIEW) which map to item-level status checks.
 */
public record ListReviewQueueFilter(
    String status,
    String search,
    Long productId,
    Long teamId,
    boolean mineOnly,
    /** When non-null, restricts results to "CATALOG" or "INTAKE" requests. */
    String requestType
) {}
