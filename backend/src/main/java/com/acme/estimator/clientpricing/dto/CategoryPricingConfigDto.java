package com.acme.estimator.clientpricing.dto;

import java.math.BigDecimal;

public record CategoryPricingConfigDto(
    Long categoryId,
    String categoryName,
    boolean categoryActive,
    String pricingModel,
    BigDecimal overrideTmMultiplier,
    BigDecimal overrideTmTargetMarginPct,
    BigDecimal overrideMatBillableRate,
    BigDecimal overrideMatDiscountPct
) {}
