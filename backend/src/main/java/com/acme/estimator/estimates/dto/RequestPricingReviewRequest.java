package com.acme.estimator.estimates.dto;

/**
 * Payload for the requester's "send for pricing review" action.
 *
 * <p>{@code context} is the free-form text the requester wants the Revenue
 * Manager to see. Null or blank is allowed; the service normalises blank to null.
 */
public record RequestPricingReviewRequest(
    String context
) {}
