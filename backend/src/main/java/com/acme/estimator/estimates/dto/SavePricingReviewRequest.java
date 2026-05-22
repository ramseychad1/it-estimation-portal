package com.acme.estimator.estimates.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Payload for Revenue Manager's save-draft and approve actions during pricing review.
 */
public record SavePricingReviewRequest(
    /** Optional global discount % applied to the total client price. */
    BigDecimal discountPct,
    /** Optional RM notes. */
    String notes,
    /** Per-item pricing model overrides. May be null or empty. */
    List<RmItemOverrideInput> itemOverrides
) {}
