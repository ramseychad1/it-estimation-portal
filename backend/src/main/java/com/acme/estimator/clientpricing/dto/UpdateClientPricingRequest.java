package com.acme.estimator.clientpricing.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;

/**
 * Per-client client-pricing override. Nullable fields (null = inherit the
 * category override / global default); bounds validated (WEB-08). No pricing
 * model here — that comes from the category.
 */
public record UpdateClientPricingRequest(
    @DecimalMin("1.0") @DecimalMax("100.0") BigDecimal overrideTmMultiplier,
    @DecimalMin("0.0") @DecimalMax("99.99") BigDecimal overrideTmTargetMarginPct,
    @DecimalMin("0.01") @DecimalMax("9999.99") BigDecimal overrideMatBillableRate,
    @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal overrideMatDiscountPct
) {}
