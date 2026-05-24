package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.Size;

/**
 * Payload for the requester's "send for pricing review" action.
 *
 * <p>{@code context} is the free-form text the requester wants the Revenue
 * Manager to see. Null or blank is allowed; the service normalises blank to null.
 * Maximum 4,000 characters to prevent unbounded storage.
 */
public record RequestPricingReviewRequest(
    @Size(max = 4000) String context
) {}
