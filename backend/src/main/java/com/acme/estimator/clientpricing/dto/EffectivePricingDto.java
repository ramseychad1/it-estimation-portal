package com.acme.estimator.clientpricing.dto;

import java.math.BigDecimal;

/**
 * Resolved pricing parameters for a category: category-level overrides merged
 * on top of global defaults. All fields are null when the category has no
 * pricing model assigned, or when the relevant default/override is unset.
 */
public record EffectivePricingDto(
    String pricingModel,
    BigDecimal tmMultiplier,
    BigDecimal tmTargetMarginPct,
    BigDecimal matBillableRate,
    BigDecimal matDiscountPct
) {
    public static EffectivePricingDto none() {
        return new EffectivePricingDto(null, null, null, null, null);
    }
}
