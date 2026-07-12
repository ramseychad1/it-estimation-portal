package com.acme.estimator.clientpricing.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;

/** Global client-pricing defaults. Nullable fields; bounds validated (WEB-08). */
public record UpdateDefaultsRequest(
    @DecimalMin("1.0") @DecimalMax("100.0") BigDecimal tmMultiplier,
    @DecimalMin("0.0") @DecimalMax("99.99") BigDecimal tmTargetMarginPct,
    @DecimalMin("0.01") @DecimalMax("9999.99") BigDecimal matBillableRate,
    @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal matDiscountPct
) {}
