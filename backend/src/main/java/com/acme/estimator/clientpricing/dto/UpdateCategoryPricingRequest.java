package com.acme.estimator.clientpricing.dto;

import java.math.BigDecimal;

public record UpdateCategoryPricingRequest(
    String pricingModel,
    BigDecimal overrideTmMultiplier,
    BigDecimal overrideTmTargetMarginPct,
    BigDecimal overrideMatBillableRate,
    BigDecimal overrideMatDiscountPct
) {}
