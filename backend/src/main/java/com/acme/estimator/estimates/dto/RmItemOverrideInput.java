package com.acme.estimator.estimates.dto;

import java.math.BigDecimal;

/**
 * Per-item pricing override set by the Revenue Manager during pricing review.
 * All fields are nullable — a null means "use the approved value."
 */
public record RmItemOverrideInput(
    Long itemId,
    String pricingModel,
    BigDecimal tmMultiplier,
    BigDecimal tmTargetMarginPct,
    BigDecimal matBillableRate,
    BigDecimal matDiscountPct
) {}
