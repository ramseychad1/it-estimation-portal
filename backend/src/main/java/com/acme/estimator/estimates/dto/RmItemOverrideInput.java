package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;

/**
 * Per-item pricing override set by the Revenue Manager during pricing review.
 * All fields are nullable — a null means "use the approved value." Bounds are
 * validated (WEB-08) so a negative/absurd value can't produce a broken quote;
 * null values skip validation.
 */
public record RmItemOverrideInput(
    Long itemId,
    String pricingModel,
    @DecimalMin("1.0") @DecimalMax("100.0") BigDecimal tmMultiplier,
    @DecimalMin("0.0") @DecimalMax("99.99") BigDecimal tmTargetMarginPct,
    @DecimalMin("0.01") @DecimalMax("9999.99") BigDecimal matBillableRate,
    @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal matDiscountPct
) {}
