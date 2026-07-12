package com.acme.estimator.estimates.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.util.List;

/**
 * Payload for Revenue Manager's save-draft and approve actions during pricing review.
 * Bounds are validated (WEB-08); {@code @Valid} cascades to each item override.
 */
public record SavePricingReviewRequest(
    /** Optional global discount % applied to the total client price. */
    @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal discountPct,
    /** Optional RM notes. */
    String notes,
    /** Per-item pricing model overrides. May be null or empty. */
    @Valid List<RmItemOverrideInput> itemOverrides
) {}
