package com.acme.estimator.clientpricing.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;

/** Per-category client-pricing override. Nullable fields; bounds validated (WEB-08). */
public record UpdateCategoryPricingRequest(
    String pricingModel,
    @DecimalMin("1.0") @DecimalMax("100.0") BigDecimal overrideTmMultiplier,
    @DecimalMin("0.0") @DecimalMax("99.99") BigDecimal overrideTmTargetMarginPct,
    @DecimalMin("0.01") @DecimalMax("9999.99") BigDecimal overrideMatBillableRate,
    @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal overrideMatDiscountPct
) {}
